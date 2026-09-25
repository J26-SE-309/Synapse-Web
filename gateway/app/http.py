"""The shared HTTP client the gateway uses to call the component services."""

import httpx2
from fastapi import Request


def get_http_client(request: Request) -> httpx2.AsyncClient:
    """FastAPI dependency: the client created once at start-up (see main.lifespan)."""
    return request.app.state.http_client
