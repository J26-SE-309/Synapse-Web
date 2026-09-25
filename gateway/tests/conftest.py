import json
from pathlib import Path

import httpx2
import pytest
from fastapi.testclient import TestClient

from app import db
from app.main import create_app

CONTRACTS = Path(__file__).resolve().parents[2] / "contracts"


def example(component: str, name: str):
    return json.loads((CONTRACTS / component / "examples" / f"{name}.json").read_text(encoding="utf-8"))


class FakeComponents:
    """Stands in for the four component services, answering with the contract examples."""

    PORTS = {8001: "requirement-quality", 8002: "story-refinement", 8003: "traceability", 8004: "effort-estimation"}

    def __init__(self) -> None:
        self.down: set[str] = set()
        self.requests: dict[str, list[httpx2.Request]] = {component: [] for component in self.PORTS.values()}

    def handler(self, request: httpx2.Request) -> httpx2.Response:
        component = self.PORTS[request.url.port]
        if component in self.down:
            raise httpx2.ConnectError("connection refused", request=request)
        self.requests[component].append(request)
        if request.url.path == "/health":
            health = {"status": "ok", "service": component, "version": "0.1.0", "database": "ok"}
            return httpx2.Response(200, json=health)
        body = json.loads(request.content) if request.content else None
        return self._respond(component, request.url.path, body)

    @staticmethod
    def _respond(component: str, path: str, body) -> httpx2.Response:
        if (component, path) == ("requirement-quality", "/api/v1/analyze/batch"):
            template = example(component, "analysis")
            return httpx2.Response(200, json=[{**template, "requirement_id": r["requirement_id"]} for r in body])
        if (component, path) == ("story-refinement", "/api/v1/refine"):
            template = example(component, "refined-story")
            ids = {"requirement_id": body["requirement_id"], "story_id": f"{body['requirement_id']}-S1"}
            return httpx2.Response(200, json={**template, **ids})
        if (component, path) == ("traceability", "/api/v1/coverage"):
            template = example(component, "coverage-response")["items"][0]
            items = [{**template, "story_id": s["story_id"]} for s in body["stories"]]
            return httpx2.Response(200, json={"items": items})
        if (component, path) == ("effort-estimation", "/api/v1/estimate"):
            template = example(component, "estimate-response")["predictions"][0]
            return httpx2.Response(
                200, json={"predictions": [{**template, "story_id": s["story_id"]} for s in body["stories"]]}
            )
        return httpx2.Response(404, json={"detail": "Not Found"})

    def last_json(self, component: str):
        return json.loads(self.requests[component][-1].content)


@pytest.fixture
def components() -> FakeComponents:
    return FakeComponents()


@pytest.fixture
def client(components, monkeypatch):
    monkeypatch.setattr(db, "database_ok", lambda: False)
    with TestClient(create_app(transport=httpx2.MockTransport(components.handler))) as test_client:
        yield test_client
