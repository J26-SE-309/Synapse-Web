from app.orchestration import upstream_signals
from tests.conftest import example

REQUIREMENTS = [
    {"requirement_id": "REQ-1", "text": "Students can book a tutor."},
    {"requirement_id": "REQ-2", "text": "Tutors can set their availability."},
]


def run(client):
    return client.post("/api/v1/pipeline/run", json={"project_id": "SYN", "requirements": REQUIREMENTS})


def test_pipeline_runs_every_stage_for_every_requirement(client):
    response = run(client)
    assert response.status_code == 200
    body = response.json()
    assert body["unavailable_components"] == []
    assert [result["requirement_id"] for result in body["results"]] == ["REQ-1", "REQ-2"]
    first = body["results"][0]
    assert first["analysis"]["requirement_id"] == "REQ-1"
    assert first["story"]["story_id"] == "REQ-1-S1"
    assert first["coverage"]["story_id"] == "REQ-1-S1"
    assert first["prediction"]["story_id"] == "REQ-1-S1"


def test_upstream_outputs_become_effort_features(client, components):
    run(client)
    story = components.last_json("effort-estimation")["stories"][0]
    analysis = example("requirement-quality", "analysis")
    refined = example("story-refinement", "refined-story")
    coverage = example("traceability", "coverage-response")["items"][0]
    assert story["upstream"] == {
        "ambiguity_score": analysis["ambiguity"]["score"],
        "vague_term_count": analysis["vagueness"]["count"],
        "missing_info_flag_count": 0,
        "ac_completeness_score": refined["quality_scores"]["completeness"],
        "invest_compliance_flags": refined["quality_scores"]["invest"],
        "traceability_coverage_pct": coverage["coverage_pct"],
        "unlinked_artifact_count": coverage["unlinked_artifact_count"],
        "has_linked_tests": coverage["has_linked_tests"],
    }
    assert story["acceptance_criteria"] == ["Given (placeholder), when (placeholder), then (placeholder)"]


def test_an_unreachable_component_is_skipped_instead_of_failing_the_run(client, components):
    components.down.add("traceability")
    body = run(client).json()
    assert body["unavailable_components"] == ["traceability"]
    assert body["results"][0]["coverage"] is None
    assert body["results"][0]["prediction"] is not None
    upstream = components.last_json("effort-estimation")["stories"][0]["upstream"]
    assert "traceability_coverage_pct" not in upstream
    assert "ambiguity_score" in upstream


def test_requirements_are_traced_as_written_when_refinement_is_down(client, components):
    components.down.add("story-refinement")
    body = run(client).json()
    assert body["unavailable_components"] == ["story-refinement"]
    traced = components.last_json("traceability")["stories"][0]
    assert traced == {"story_id": "REQ-1", "user_story": "Students can book a tutor.", "acceptance_criteria": []}
    assert body["results"][0]["prediction"]["story_id"] == "REQ-1"


def test_pipeline_needs_at_least_one_requirement(client):
    assert client.post("/api/v1/pipeline/run", json={"project_id": "SYN", "requirements": []}).status_code == 422


def test_only_missing_information_issues_count_as_missing_info_flags():
    analysis = {
        "ambiguity": {"score": 0.5},
        "vagueness": {"count": 2},
        "quality": {"issues": [{"type": "missing_information"}, {"type": "grammar"}, {"type": "missing_information"}]},
    }
    assert upstream_signals(analysis, None, None)["missing_info_flag_count"] == 2


def test_a_payload_that_breaks_its_contract_does_not_break_the_others():
    coverage = {"coverage_pct": 0.4, "unlinked_artifact_count": 1, "has_linked_tests": True}
    signals = upstream_signals({"unexpected": "shape"}, None, coverage)
    assert "ambiguity_score" not in signals
    assert signals["traceability_coverage_pct"] == 0.4
