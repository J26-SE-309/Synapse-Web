"""The JSON contracts in ../contracts are checked here, so CI fails when an example drifts from its schema."""

import json

import jsonschema
import pytest

from app.api.v1.backlog import (
    ImportResult,
    Sprint,
    SprintCreate,
    SprintUpdate,
    Story,
    StoryCreate,
    StoryImport,
    StoryUpdate,
)
from app.api.v1.projects import Project, ProjectCreate, ProjectUpdate
from app.orchestration import PipelineRequest, PipelineResponse
from tests.conftest import CONTRACTS

EXAMPLES = sorted(CONTRACTS.glob("*/examples/*.json"))


def test_every_component_and_the_pipeline_have_contracts():
    folders = {path.parent.parent.name for path in EXAMPLES}
    assert folders == {"common", "requirement-quality", "story-refinement", "traceability", "effort-estimation"}


@pytest.mark.parametrize("path", EXAMPLES, ids=lambda path: f"{path.parent.parent.name}/{path.stem}")
def test_example_matches_its_schema(path):
    schema = json.loads((path.parent.parent / f"{path.stem}.schema.json").read_text(encoding="utf-8"))
    jsonschema.Draft202012Validator.check_schema(schema)
    jsonschema.Draft202012Validator(schema).validate(json.loads(path.read_text(encoding="utf-8")))


@pytest.mark.parametrize(
    ("name", "model"),
    [
        ("pipeline-run-request", PipelineRequest),
        ("pipeline-run-response", PipelineResponse),
        ("project", Project),
        ("project-create", ProjectCreate),
        ("project-update", ProjectUpdate),
        ("story", Story),
        ("story-create", StoryCreate),
        ("story-update", StoryUpdate),
        ("story-import", StoryImport),
        ("story-import-result", ImportResult),
        ("sprint", Sprint),
        ("sprint-create", SprintCreate),
        ("sprint-update", SprintUpdate),
    ],
)
def test_common_contracts_match_the_gateway_code(name, model):
    stored = json.loads((CONTRACTS / "common" / f"{name}.schema.json").read_text(encoding="utf-8"))
    assert stored == {"$schema": "https://json-schema.org/draft/2020-12/schema", **model.model_json_schema()}
