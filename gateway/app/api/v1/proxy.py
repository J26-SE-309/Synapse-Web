"""Forward /api/v1/<component>/<path> to the component's own /api/v1/<path>.

Components add endpoints without touching the gateway: anything under their
slug is passed through unchanged, including the status code and body.
"""

from typing import Annotated

import httpx2
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from app.config import get_settings
from app.http import get_http_client

router = APIRouter(tags=["proxy"])

# Headers that describe one hop of the connection, not the message, and must not be forwarded.
_HOP_BY_HOP = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
    "host",
    "content-length",
}


def _response_header_allowed(name: str) -> bool:
    name = name.lower()
    # The body is already decoded by the client, and CORS is answered by the gateway itself.
    return name not in _HOP_BY_HOP and name != "content-encoding" and not name.startswith("access-control-")


@router.api_route(
    "/{component}/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    include_in_schema=False,
)
async def proxy(
    component: str, path: str, request: Request, client: Annotated[httpx2.AsyncClient, Depends(get_http_client)]
) -> Response:
    base_url = get_settings().component_urls().get(component)
    if base_url is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Unknown component '{component}'")

    headers = {name: value for name, value in request.headers.items() if name.lower() not in _HOP_BY_HOP}
    try:
        upstream = await client.request(
            request.method,
            f"{base_url}/api/v1/{path}",
            params=list(request.query_params.multi_items()),
            content=await request.body(),
            headers=headers,
        )
    except httpx2.HTTPError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, f"The {component} service is not reachable") from None

    return Response(
        content=upstream.content,
        status_code=upstream.status_code,
        headers={name: value for name, value in upstream.headers.items() if _response_header_allowed(name)},
    )
