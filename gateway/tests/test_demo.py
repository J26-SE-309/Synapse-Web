from app import db, demo, keys, sprint_sync, tables

PROJECT = "/api/v1/projects/MY-FIRST-PROJECT"
CLEAR = {"title": "As a student I want to book a session so that I get help",
         "description": "Students pick a tutor, a date and a free time slot, then confirm the booking by email.",
         "acceptance_criteria": ["Given a free slot, when I confirm it, then the session is booked"],
         "epic": "Booking", "needed_by": 1}
VAGUE = {"title": "Improve the booking page", "description": "Make it fast and user-friendly etc."}


def _project(client) -> dict:
    return client.post("/api/v1/projects", json={"id": "MY-FIRST-PROJECT", "name": "My First Project"}).json()


def test_keys_come_from_the_name_and_are_never_shared():
    assert keys.suggest("My First Project", set()) == "MFP"
    assert keys.suggest("Tutoring", set()) == "TUT"
    assert keys.suggest("My First Project", {"MFP"}) == "MFP2"
    assert keys.suggest("A very long project name with words", set()) == "AVLPN"


def test_stories_and_sprints_get_short_ids_from_the_project_key(client, database):
    assert _project(client)["key"] == "MFP"
    assert client.get("/api/v1/projects/key-suggestion", params={"name": "My Fine Plan"}).json() == {"key": "MFP2"}
    taken = client.post("/api/v1/projects", json={"id": "OTHER", "name": "Other", "key": "MFP"})
    assert taken.status_code == 409
    assert client.post(f"{PROJECT}/stories", json=CLEAR).json()["story_id"] == "MFP-1"
    sprint = client.post(f"{PROJECT}/sprints", json={}).json()
    assert (sprint["sprint_id"], sprint["name"]) == ("MFP-S1", "Sprint 1")


def test_every_story_gets_complete_signals_that_follow_it(client, database):
    _project(client)
    clear = client.post(f"{PROJECT}/stories", json=CLEAR).json()
    vague = client.post(f"{PROJECT}/stories", json=VAGUE).json()
    for story in (clear, vague):
        assert story["upstream"]["source"] == "platform"
        assert all(value is not None for value in story["upstream"].values())
    good, bad = clear["upstream"], vague["upstream"]
    assert good["ambiguity_score"] < bad["ambiguity_score"] and bad["vague_term_count"] >= 3
    assert good["ac_completeness_score"] > 0.6 and bad["ac_completeness_score"] == 0
    assert good["traceability_coverage_pct"] == 1 and good["has_linked_tests"]
    # worked out again when the story changes
    criteria = {"acceptance_criteria": ["Given the page, when it loads, then it shows the slots within a second"]}
    edited = client.patch(f"{PROJECT}/stories/{vague['story_id']}", json=criteria).json()
    assert edited["upstream"]["ac_completeness_score"] > 0 and edited["upstream"]["has_linked_tests"]
    preview = client.post(f"{PROJECT}/stories/signals", json=VAGUE).json()
    assert preview == bad
    assert len(client.get(f"{PROJECT}/stories").json()) == 2  # the preview saved nothing


def test_the_demo_project_has_four_finished_sprints_and_a_fifth_running(client, database):
    _project(client)
    client.post(f"{PROJECT}/stories", json=VAGUE)
    with db.SessionLocal() as session:
        ids = demo.build(session, "MY-FIRST-PROJECT")
    assert ids == [f"MFP-S{n}" for n in range(1, 6)]
    sprints = {s["sprint_id"]: s for s in client.get(f"{PROJECT}/sprints").json()}
    assert [sprints[i]["name"] for i in ids] == [f"Sprint {n}" for n in range(1, 6)]
    assert [sprints[i]["status"] for i in ids] == ["closed"] * 4 + ["active"]
    stories = client.get(f"{PROJECT}/stories").json()
    assert len(stories) == len(demo.STORIES) and stories[0]["story_id"] == "MFP-1"  # the old story is gone
    for story in stories:  # complete stories, complete signals
        assert story["description"] and story["acceptance_criteria"] and story["epic"] and story["priority"]
        assert story["upstream"]["ac_completeness_score"] >= 0.75 and story["upstream"]["has_linked_tests"]
        assert story["upstream"]["ambiguity_score"] <= 0.2
    with db.SessionLocal() as session:
        records = [sprint_sync.sprint_record(session, "MY-FIRST-PROJECT", i) for i in ids]
        assert all(s.synthetic for s in session.query(tables.Story).filter_by(project_id="MY-FIRST-PROJECT"))
    closed = records[:4]
    assert all(r["started_at"] < r["closed_at"] for r in closed)
    spilled = [s["story_id"] for r in closed for s in r["stories"] if not s["done_in_sprint"]]
    assert len(spilled) == 4
    running = {s["story_id"] for s in records[4]["stories"]}
    assert spilled[-1] in running  # carried over from Sprint 4
    done = [sum(s["points_at_close"] for s in r["stories"] if s["done_in_sprint"]) for r in closed]
    committed = sum(s["points_at_commit"] for s in records[4]["stories"])
    assert 1.1 < committed / (sum(done[1:]) / 3) < 1.4  # Sprint 5 a little above the team's pace
