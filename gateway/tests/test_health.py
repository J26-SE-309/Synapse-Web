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
