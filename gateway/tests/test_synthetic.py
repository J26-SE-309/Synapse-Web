from app import db, sprint_sync, synthetic, tables

PROJECT = "/api/v1/projects/TUTOR"
CLEAR = {"title": "As a student I want to book a session so that I get help",
         "description": "Students pick a tutor, a date and a free time slot, then confirm the booking by email.",
         "acceptance_criteria": ["Given a free slot, when I confirm it, then the session is booked"],
         "epic": "Booking"}
VAGUE = {"title": "Improve the booking page", "description": "Make it fast and user-friendly etc."}


def _project(client):
    client.post("/api/v1/projects", json={"id": "TUTOR", "name": "Tutoring app"})
    client.post(f"{PROJECT}/stories/import", json={"stories": [CLEAR, VAGUE]})
    return {s["story_id"]: s for s in client.get(f"{PROJECT}/stories").json()}


def test_synthetic_signals_follow_the_story_and_are_labelled(client, database):
    _project(client)
    with db.SessionLocal() as session:
        assert synthetic.add_signals(session, "TUTOR") == 2
        assert synthetic.add_signals(session, "TUTOR") == 0  # stories with signals keep them
    stories = client.get(f"{PROJECT}/stories").json()
    clear, vague = (s["upstream"] for s in stories)
    assert clear["source"] == vague["source"] == "synthetic"
    assert clear["ambiguity_score"] < vague["ambiguity_score"] and vague["vague_term_count"] >= 3
    assert clear["ac_completeness_score"] > 0.5 and vague["ac_completeness_score"] < 0.1
    assert clear["invest_compliance_flags"]["valuable"] and not vague["invest_compliance_flags"]["valuable"]
    # the signals described the text: editing it clears them, other edits keep them
    client.patch(f"{PROJECT}/stories/TUTOR-1", json={"story_points": 5})
    assert client.get(f"{PROJECT}/stories/TUTOR-1").json()["upstream"] == clear
    client.patch(f"{PROJECT}/stories/TUTOR-1", json={"description": "Pick a tutor and a slot."})
    assert client.get(f"{PROJECT}/stories/TUTOR-1").json()["upstream"] is None


def test_synthetic_history_is_closed_sprints_before_the_first_one_and_can_be_removed(client, database):
    _project(client)
    with db.SessionLocal() as session:
        ids = synthetic.add_history(session, "TUTOR")
        assert ids == [f"TUTOR-SYN-S{n}" for n in range(1, 5)]
        assert synthetic.add_history(session, "TUTOR") == []  # only once
    sprints = {s["sprint_id"]: s for s in client.get(f"{PROJECT}/sprints").json()}
    assert all(sprints[i]["status"] == "closed" and sprints[i]["name"].startswith("Synthetic") for i in ids)
    with db.SessionLocal() as session:
        records = [sprint_sync.sprint_record(session, "TUTOR", i) for i in ids]
        made_up = session.query(tables.Story).filter_by(project_id="TUTOR", synthetic=True).all()
    assert len(made_up) == len(synthetic.HISTORY_STORIES) and all(s.status == "done" for s in made_up)
    spilled = [s for r in records for s in r["stories"] if not s["done_in_sprint"]]
    assert 3 <= len(spilled) <= 6 and all(s["done_in_sprint"] for s in records[-1]["stories"])
    assert all(r["started_at"] < r["closed_at"] for r in records)
    with db.SessionLocal() as session:
        synthetic.add_signals(session, "TUTOR")
        removed, stories, cleared = synthetic.remove(session, "TUTOR")
    assert removed == ids and stories == len(synthetic.HISTORY_STORIES) and cleared == 2
    assert client.get(f"{PROJECT}/sprints").json() == []
    assert [s["story_id"] for s in client.get(f"{PROJECT}/stories").json()] == ["TUTOR-1", "TUTOR-2"]
