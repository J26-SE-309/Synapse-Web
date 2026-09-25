"""The JSON contracts in ../contracts are checked here, so CI fails when an example drifts from its schema."""

import json

import jsonschema
import pytest

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
    ("name", "model"), [("pipeline-run-request", PipelineRequest), ("pipeline-run-response", PipelineResponse)]
)
def test_pipeline_contract_matches_the_gateway_code(name, model):
    stored = json.loads((CONTRACTS / "common" / f"{name}.schema.json").read_text(encoding="utf-8"))
    assert stored == {"$schema": "https://json-schema.org/draft/2020-12/schema", **model.model_json_schema()}
