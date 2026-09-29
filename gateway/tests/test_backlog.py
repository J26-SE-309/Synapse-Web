import json

import pytest
from sqlalchemy import inspect

PROJECT = "/api/v1/projects/TUTOR"


@pytest.fixture
def tutor(client, database):
    client.post("/api/v1/projects", json={"id": "TUTOR", "name": "Tutoring app"})
    return client


def story(title: str, **fields) -> dict:
    return {"title": title, **fields}


def effort_records(components) -> list[tuple[str, dict]]:
    """What the effort service was sent: (path, sprint record) for each PUT of a sprint."""
    return [(request.url.path, json.loads(request.content)) for request in components.requests["effort-estimation"]
            if request.method == "PUT"]


def test_the_migration_creates_the_backlog_tables(database):
    assert {"stories", "sprints", "sprint_items"} <= set(inspect(database).get_table_names())
    assert "rank" in {column["name"] for column in inspect(database).get_columns("stories")}


def test_the_backlog_keeps_the_order_it_is_dragged_into(tutor):
    for title in ("A", "B", "C"):
        tutor.post(f"{PROJECT}/stories", json=story(title))
    tutor.post(f"{PROJECT}/stories/import", json={"stories": [story("D"), story("E")]})
    ranks = {s["story_id"]: s["rank"] for s in tutor.get(f"{PROJECT}/stories").json()}
    assert ranks == {"TUTOR-1": 1, "TUTOR-2": 2, "TUTOR-3": 3, "TUTOR-4": 4, "TUTOR-5": 5}
    # C dropped between A and B takes a rank between theirs
    tutor.patch(f"{PROJECT}/stories/TUTOR-3", json={"rank": 1.5})
    assert [s["title"] for s in tutor.get(f"{PROJECT}/stories").json()] == ["A", "C", "B", "D", "E"]
    assert tutor.patch(f"{PROJECT}/stories/TUTOR-3", json={"rank": None}).status_code == 422


def test_stories_get_the_next_free_id_and_keep_every_detail(tutor):
    first = tutor.post(f"{PROJECT}/stories", json=story(
        "  As a student I want to book a session  ", description="Pick a tutor and a time",
        acceptance_criteria=["Given a free slot, when I book it, then it is mine"], issue_type="Story",
        priority="Major", story_points=3, epic="Booking", blocked_by=1, depends_on=2, needed_by=0))
    assert first.status_code == 201
    body = first.json()
    assert body["story_id"] == "TUTOR-1"
    assert body["title"] == "As a student I want to book a session"
    assert (body["status"], body["sprint_id"], body["source"], body["synthetic"]) == ("to_do", None, "manual", False)
    assert tutor.post(f"{PROJECT}/stories", json=story("Second")).json()["story_id"] == "TUTOR-2"
    tutor.post(f"{PROJECT}/stories", json=story("Own id", story_id="TUTOR-10"))
    assert tutor.post(f"{PROJECT}/stories", json=story("After")).json()["story_id"] == "TUTOR-11"
    assert [s["story_id"] for s in tutor.get(f"{PROJECT}/stories").json()] == ["TUTOR-1", "TUTOR-2", "TUTOR-10",
                                                                               "TUTOR-11"]
    assert tutor.post(f"{PROJECT}/stories", json=story("Again", story_id="TUTOR-2")).status_code == 409


@pytest.mark.parametrize("fields", [
    {"title": " "},
    {"title": "x" * 301},
    {"title": "Points", "story_points": -1},
    {"title": "Type", "issue_type": "Epic"},
    {"title": "Id", "story_id": "has space"},
    {"title": "Criteria", "acceptance_criteria": [""]},
])
def test_a_story_is_checked_like_the_contract_says(tutor, fields):
    assert tutor.post(f"{PROJECT}/stories", json=fields).status_code == 422


def test_an_unknown_project_or_story_is_404(tutor):
    assert tutor.get("/api/v1/projects/NOPE/stories").status_code == 404
    assert tutor.get(f"{PROJECT}/stories/TUTOR-99").status_code == 404
    assert tutor.patch(f"{PROJECT}/stories/TUTOR-99", json={"title": "x"}).status_code == 404


def test_a_story_is_edited_field_by_field_and_its_title_cannot_be_emptied(tutor):
    tutor.post(f"{PROJECT}/stories", json=story("Book", priority="Major", story_points=3))
    edited = tutor.patch(f"{PROJECT}/stories/TUTOR-1", json={"story_points": 5, "priority": None}).json()
    assert (edited["title"], edited["story_points"], edited["priority"]) == ("Book", 5, None)
    assert tutor.patch(f"{PROJECT}/stories/TUTOR-1", json={"title": None}).status_code == 422


def test_an_import_adds_every_story_or_none(tutor):
    tutor.post(f"{PROJECT}/stories", json=story("Existing", story_id="TUTOR-1"))
    clash = tutor.post(f"{PROJECT}/stories/import", json={"stories": [story("New"), story("Old", story_id="TUTOR-1")]})
    assert clash.status_code == 409
    assert len(tutor.get(f"{PROJECT}/stories").json()) == 1
    done = tutor.post(f"{PROJECT}/stories/import", json={"stories": [story("A"), story("B")], "synthetic": True})
    assert done.status_code == 201
    assert [(s["story_id"], s["source"], s["synthetic"]) for s in done.json()["stories"]] == [
        ("TUTOR-2", "import", True), ("TUTOR-3", "import", True)]


def test_an_import_can_plan_a_sprint_with_its_stories(tutor):
    result = tutor.post(f"{PROJECT}/stories/import", json={
        "stories": [story("A", story_points=3), story("B")],
        "sprint": {"sprint_id": "TUTOR-S1", "length_days": 10, "capacity_points": 20}}).json()
    sprint = result["sprint"]
    assert (sprint["sprint_id"], sprint["name"], sprint["status"], sprint["capacity_points"]) == (
        "TUTOR-S1", "Sprint 1", "planned", 20)
    assert [item["story_id"] for item in sprint["items"]] == ["TUTOR-1", "TUTOR-2"]
    assert {s["sprint_id"] for s in tutor.get(f"{PROJECT}/stories").json()} == {"TUTOR-S1"}


def test_a_sprint_from_planning_to_its_close(tutor, components):
    for title, points in (("Book", 3), ("Pay", 5), ("Cancel", 2)):
        tutor.post(f"{PROJECT}/stories", json=story(title, story_points=points, issue_type="Story"))
    sprint = tutor.post(f"{PROJECT}/sprints", json={"goal": "Bookings work", "capacity_points": 12}).json()
    assert (sprint["sprint_id"], sprint["name"], sprint["effort_sync"]["status"]) == ("TUTOR-S1", "Sprint 1",
                                                                                     "not_sent")
    assert tutor.post(f"{PROJECT}/sprints/TUTOR-S1/start").status_code == 409  # no stories yet
    for story_id in ("TUTOR-1", "TUTOR-2"):
        tutor.patch(f"{PROJECT}/stories/{story_id}", json={"sprint_id": "TUTOR-S1"})
    assert effort_records(components) == []  # a planned sprint is not sent

    started = tutor.post(f"{PROJECT}/sprints/TUTOR-S1/start").json()
    assert started["status"] == "active" and started["planned_end"] > started["started_at"]
    assert all(item["committed_at"] == started["started_at"] and not item["added_mid_sprint"]
               for item in started["items"])
    path, record = effort_records(components)[-1]
    assert path == "/api/v1/projects/TUTOR/sprints/TUTOR-S1"
    assert record["name"] == "Sprint 1" and "closed_at" not in record
    assert [(s["story_id"], s["points_at_commit"]) for s in record["stories"]] == [("TUTOR-1", 3), ("TUTOR-2", 5)]
    assert tutor.get(f"{PROJECT}/sprints/TUTOR-S1").json()["effort_sync"]["status"] == "sent"

    tutor.patch(f"{PROJECT}/stories/TUTOR-1", json={"status": "in_progress"})
    tutor.patch(f"{PROJECT}/stories/TUTOR-1", json={"status": "done"})
    tutor.patch(f"{PROJECT}/stories/TUTOR-3", json={"sprint_id": "TUTOR-S1"})  # added mid-sprint
    items = {item["story_id"]: item for item in tutor.get(f"{PROJECT}/sprints/TUTOR-S1").json()["items"]}
    assert items["TUTOR-3"]["added_mid_sprint"] and items["TUTOR-3"]["points_at_commit"] == 2
    assert tutor.post(f"{PROJECT}/sprints", json={}).json()["sprint_id"] == "TUTOR-S2"
    assert tutor.post(f"{PROJECT}/sprints/TUTOR-S2/start").status_code == 409  # one sprint at a time

    closed = tutor.post(f"{PROJECT}/sprints/TUTOR-S1/close").json()
    assert closed["status"] == "closed" and closed["closed_at"]
    outcome = {item["story_id"]: item["done_in_sprint"] for item in closed["items"]}
    assert outcome == {"TUTOR-1": True, "TUTOR-2": False, "TUTOR-3": False}
    where = {s["story_id"]: s["sprint_id"] for s in tutor.get(f"{PROJECT}/stories").json()}
    assert where == {"TUTOR-1": "TUTOR-S1", "TUTOR-2": None, "TUTOR-3": None}  # unfinished: back to the backlog
    _, record = effort_records(components)[-1]
    assert record["closed_at"]
    sent = {s["story_id"]: s for s in record["stories"]}
    assert sent["TUTOR-1"]["done_in_sprint"] is True and sent["TUTOR-1"]["hours_in_progress"] >= 0
    assert sent["TUTOR-2"]["done_in_sprint"] is False and "resolved_at" not in sent["TUTOR-2"]
    assert tutor.patch(f"{PROJECT}/stories/TUTOR-2", json={"sprint_id": "TUTOR-S1"}).status_code == 409


def test_a_story_taken_out_of_an_active_sprint_keeps_its_record(tutor, components):
    tutor.post(f"{PROJECT}/stories/import", json={"stories": [story("A"), story("B")],
                                                  "sprint": {"sprint_id": "TUTOR-S1"}})
    tutor.post(f"{PROJECT}/sprints/TUTOR-S1/start")
    tutor.patch(f"{PROJECT}/stories/TUTOR-2", json={"sprint_id": None})
    items = {item["story_id"]: item for item in tutor.get(f"{PROJECT}/sprints/TUTOR-S1").json()["items"]}
    assert items["TUTOR-2"]["left_at"] is not None
    _, record = effort_records(components)[-1]
    assert "left_at" in {s["story_id"]: s for s in record["stories"]}["TUTOR-2"]


def test_reopening_a_done_story_is_recorded(tutor):
    tutor.post(f"{PROJECT}/stories", json=story("A"))
    tutor.patch(f"{PROJECT}/stories/TUTOR-1", json={"status": "done"})
    reopened = tutor.patch(f"{PROJECT}/stories/TUTOR-1", json={"status": "in_progress"}).json()
    assert reopened["reopened"] and reopened["resolved_at"] is None and reopened["started_at"]


def test_history_stays_but_plans_can_be_undone(tutor):
    tutor.post(f"{PROJECT}/stories/import", json={"stories": [story("A"), story("B")],
                                                  "sprint": {"sprint_id": "TUTOR-S1"}})
    assert tutor.delete(f"{PROJECT}/stories/TUTOR-2").status_code == 204  # only planned so far
    assert tutor.delete(f"{PROJECT}/sprints/TUTOR-S1").status_code == 204
    assert tutor.get(f"{PROJECT}/stories/TUTOR-1").json()["sprint_id"] is None
    tutor.post(f"{PROJECT}/sprints", json={"sprint_id": "TUTOR-S2"})
    tutor.patch(f"{PROJECT}/stories/TUTOR-1", json={"sprint_id": "TUTOR-S2"})
    tutor.post(f"{PROJECT}/sprints/TUTOR-S2/start")
    assert tutor.delete(f"{PROJECT}/sprints/TUTOR-S2").status_code == 409
    assert tutor.delete(f"{PROJECT}/stories/TUTOR-1").status_code == 409
    tutor.post(f"{PROJECT}/sprints/TUTOR-S2/close")
    assert tutor.patch(f"{PROJECT}/sprints/TUTOR-S2", json={"name": "Renamed"}).status_code == 409


def test_an_unreachable_effort_service_is_recorded_and_can_be_retried(tutor, components):
    tutor.post(f"{PROJECT}/stories/import", json={"stories": [story("A")], "sprint": {"sprint_id": "TUTOR-S1"}})
    components.down.add("effort-estimation")
    started = tutor.post(f"{PROJECT}/sprints/TUTOR-S1/start")
    assert started.status_code == 200  # the platform's change stands
    sync = tutor.get(f"{PROJECT}/sprints/TUTOR-S1").json()["effort_sync"]
    assert sync["status"] == "failed" and "could not be reached" in sync["error"]
    components.down.clear()
    retried = tutor.post(f"{PROJECT}/sprints/TUTOR-S1/sync").json()["effort_sync"]
    assert retried["status"] == "sent" and retried["error"] is None
