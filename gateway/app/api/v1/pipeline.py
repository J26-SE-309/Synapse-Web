from typing import Annotated

import httpx2
from fastapi import APIRouter, Depends

from app.config import get_settings
from app.http import get_http_client
from app.orchestration import PipelineRequest, PipelineResponse, run_pipeline

router = APIRouter(tags=["pipeline"])


@router.post("/pipeline/run", response_model=PipelineResponse)
async def run(
    request: PipelineRequest, client: Annotated[httpx2.AsyncClient, Depends(get_http_client)]
) -> PipelineResponse:
    """Run raw requirements through all four components and return every stage's result."""
    return await run_pipeline(request, client, get_settings().component_urls())
