import pytest
from sqlalchemy import inspect
from sqlalchemy.orm import sessionmaker

from app import db, devdata

from .conftest import memory_engine

TUTOR = {"id": "TUTOR", "name": "Tutoring app", "description": "Booking and paying for tutoring sessions"}


def test_the_migration_creates_the_projects_table(database):
    columns = {column["name"] for column in inspect(database).get_columns("projects")}
    assert columns == {"id", "name", "description", "data_source", "created_at"}


def test_a_created_project_is_listed(client, database):
    assert client.get("/api/v1/projects").json() == []
    created = client.post("/api/v1/projects", json={**TUTOR, "name": "  Tutoring app  "})
    assert created.status_code == 201
    body = created.json()
    assert body["name"] == "Tutoring app"  # surrounding spaces are dropped
    assert body["data_source"] == "platform"
    assert client.get("/api/v1/projects").json() == [body]
    assert client.get("/api/v1/projects/TUTOR").json() == body


def test_projects_are_listed_by_name(client, database):
    client.post("/api/v1/projects", json={"id": "ZED", "name": "Alpha"})
    client.post("/api/v1/projects", json={"id": "ABC", "name": "Beta"})
    assert [p["id"] for p in client.get("/api/v1/projects").json()] == ["ZED", "ABC"]


def test_an_id_can_be_used_once(client, database):
    client.post("/api/v1/projects", json=TUTOR)
    again = client.post("/api/v1/projects", json={**TUTOR, "name": "Another"})
    assert again.status_code == 409
    assert "already exists" in again.json()["detail"]


@pytest.mark.parametrize("project_id", ["tutor", "T", "SYN--X", "-SYN", "SYN-", "MY APP", "1ST", "A" * 33, "SYN_X"])
def test_ids_are_short_capital_keys(client, database, project_id):
    assert client.post("/api/v1/projects", json={**TUTOR, "id": project_id}).status_code == 422


@pytest.mark.parametrize("change", [{"name": ""}, {"name": "   "}, {"name": "x" * 81}, {"description": "x" * 501}])
def test_names_and_descriptions_are_checked(client, database, change):
    assert client.post("/api/v1/projects", json={**TUTOR, **change}).status_code == 422


def test_a_project_can_be_renamed_but_keeps_its_id(client, database):
    client.post("/api/v1/projects", json=TUTOR)
    renamed = client.patch("/api/v1/projects/TUTOR", json={"name": "Tutor finder", "id": "OTHER"})
    assert renamed.status_code == 200
    assert renamed.json()["id"] == "TUTOR"
    assert renamed.json()["name"] == "Tutor finder"
    assert renamed.json()["description"] == TUTOR["description"]
    assert client.patch("/api/v1/projects/TUTOR", json={"name": ""}).status_code == 422


def test_unknown_projects_are_not_found(client, database):
    assert client.get("/api/v1/projects/NOPE").status_code == 404
    assert client.patch("/api/v1/projects/NOPE", json={"name": "x"}).status_code == 404


def test_projects_answer_503_without_the_database(client):
    unmigrated = sessionmaker(bind=memory_engine())

    def session():
        with unmigrated() as opened:
            yield opened

    client.app.dependency_overrides[db.get_session] = session
    response = client.get("/api/v1/projects")
    assert response.status_code == 503
    assert response.json()["detail"] == "The platform database is not reachable"


def test_component_paths_still_reach_the_components(client, database, components):
    # /api/v1/projects is the gateway's own, but a component's /api/v1/<slug>/projects/... is passed through.
    assert client.get("/api/v1/effort-estimation/projects/TUTOR/history").status_code == 404
    assert components.requests["effort-estimation"][-1].url.path == "/api/v1/projects/TUTOR/history"


def test_development_projects_are_labelled_and_removable(client, database):
    client.post("/api/v1/projects", json=TUTOR)
    added = devdata.load()
    assert "SYN-STEADY" in added and "TAWOS-MESOS" in added
    assert devdata.load() == []  # already there
    listed = {p["id"]: p for p in client.get("/api/v1/projects").json()}
    assert listed["SYN-STEADY"]["data_source"] == "synthetic"
    assert listed["TAWOS-MESOS"]["data_source"] == "tawos"
    assert "not for evaluation" in listed["SYN-STEADY"]["description"]
    assert devdata.remove() == len(devdata.DEV_PROJECTS)
    assert [p["id"] for p in client.get("/api/v1/projects").json()] == ["TUTOR"]
