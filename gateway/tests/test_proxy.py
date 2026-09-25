def test_proxy_forwards_method_path_query_and_body(client, components):
    payload = {"project_id": "SYN", "stories": [{"story_id": "S-9", "user_story": "As a tutor..."}]}
    response = client.post("/api/v1/traceability/coverage?verbose=1", json=payload)
    assert response.status_code == 200
    assert response.json()["items"][0]["story_id"] == "S-9"
    forwarded = components.requests["traceability"][-1]
    assert forwarded.method == "POST"
    assert forwarded.url.path == "/api/v1/coverage"
    assert forwarded.url.params["verbose"] == "1"


def test_proxy_passes_error_statuses_through(client):
    assert client.get("/api/v1/effort-estimation/does-not-exist").status_code == 404


def test_unknown_component_is_not_found(client):
    response = client.get("/api/v1/billing/invoices")
    assert response.status_code == 404
    assert "Unknown component" in response.json()["detail"]


def test_unreachable_component_is_service_unavailable(client, components):
    components.down.add("story-refinement")
    response = client.post("/api/v1/story-refinement/refine", json={})
    assert response.status_code == 503
    assert "story-refinement" in response.json()["detail"]
