"""FastAPI application for the Synapse API gateway."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import httpx2
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api import health
from app.api.v1 import pipeline, proxy
from app.config import get_settings


def create_app(transport: httpx2.AsyncBaseTransport | None = None) -> FastAPI:
    """Build the app. Tests pass a mock transport instead of calling real services."""
    settings = get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        async with httpx2.AsyncClient(transport=transport, timeout=settings.service_timeout_seconds) as client:
            app.state.http_client = client
            yield

    app = FastAPI(title="Synapse API Gateway", version=__version__, lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health.router)
    # The pipeline must be registered before the catch-all proxy route.
    app.include_router(pipeline.router, prefix="/api/v1")
    app.include_router(proxy.router, prefix="/api/v1")
    return app


app = create_app()
