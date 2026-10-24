def test_health_reports_every_component_in_pipeline_order(client):
    body = client.get("/health").json()
    assert body["status"] == "ok"
    assert body["database"] == "unavailable"
    assert list(body["components"]) == ["requirement-quality", "story-refinement", "traceability", "effort-estimation"]
    assert all(status == {"status": "up", "version": "0.1.0"} for status in body["components"].values())


def test_health_marks_unreachable_components_as_down(client, components):
    components.down.add("traceability")
    statuses = client.get("/health").json()["components"]
    assert statuses["traceability"] == {"status": "down", "version": None}
    assert statuses["effort-estimation"]["status"] == "up"


def test_health_does_not_query_a_hosted_database(client, monkeypatch):
    """The web app polls /health every 15 s: querying Neon each time would keep it from ever suspending."""
    from app import db

    def query():
        raise AssertionError("a hosted database must not be queried by /health")

    monkeypatch.setattr(db, "hosted", True)
    monkeypatch.setattr(db, "database_ok", query)
    monkeypatch.setattr(db, "_down_until", 0.0)
    assert client.get("/health").json()["database"] == "ok"
    monkeypatch.setattr(db, "_down_until", float("inf"))  # a connection failed a moment ago
    assert client.get("/health").json()["database"] == "unavailable"


def test_the_hosted_database_comes_from_database_url():
    from app.config import Settings
    from app.db import is_hosted

    local = Settings(_env_file=None)
    assert local.database == local.local_database_url and not is_hosted(local.database)
    neon = Settings(_env_file=None, database_url="postgresql://platform_user:pw@ep-x.aws.neon.tech/platform_db")
    assert neon.database == "postgresql+psycopg://platform_user:pw@ep-x.aws.neon.tech/platform_db"
    assert is_hosted(neon.database)
    assert not is_hosted("postgresql+psycopg://platform_user:pw@platform-db:5432/platform_db")
