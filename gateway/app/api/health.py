import asyncio
from typing import Annotated, Literal

import httpx2
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from app import __version__, db
from app.config import get_settings
from app.http import get_http_client

router = APIRouter(tags=["health"])


class ComponentStatus(BaseModel):
    status: Literal["up", "down"]
    version: str | None = None


class PlatformHealth(BaseModel):
    status: Literal["ok"]
    service: Literal["gateway"] = "gateway"
    version: str
    database: Literal["ok", "unavailable"]
    components: dict[str, ComponentStatus]


@router.get("/health", response_model=PlatformHealth)
async def health(client: Annotated[httpx2.AsyncClient, Depends(get_http_client)]) -> PlatformHealth:
    """The gateway's own status plus whether each component service is reachable."""
    settings = get_settings()

    async def check(base_url: str) -> ComponentStatus:
        try:
            response = await client.get(f"{base_url}/health", timeout=settings.health_timeout_seconds)
            response.raise_for_status()
            return ComponentStatus(status="up", version=response.json().get("version"))
        except (httpx2.HTTPError, ValueError):
            return ComponentStatus(status="down")

    urls = settings.component_urls()
    statuses = await asyncio.gather(*(check(url) for url in urls.values()))
    database_ok = await run_in_threadpool(db.database_ok)
    return PlatformHealth(
        status="ok",
        version=__version__,
        database="ok" if database_ok else "unavailable",
        components=dict(zip(urls, statuses, strict=True)),
    )
