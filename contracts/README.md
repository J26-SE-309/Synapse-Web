# Contracts

The JSON shapes the components exchange. Every component service validates its own requests and responses
with Pydantic models (`backend/app/schemas.py` in its repository); the files here are the shared, reviewable
copy that the other components, the gateway and the web app build against.

| Folder | Owner | Contents |
|---|---|---|
| `requirement-quality/` | Ama (@AmaLiyanage) | `POST /api/v1/analyze` request and response |
| `story-refinement/` | Sathmi (@lewkes) | `POST /api/v1/refine` request and response |
| `traceability/` | Lakviru (@dinuwa2500) | `POST /api/v1/coverage` request and response |
| `effort-estimation/` | Nikeshala (@Nikeshala22) | `POST /api/v1/estimate` request and response (proposal Appendix C) |
| `common/` | shared (lead approval) | `POST /api/v1/pipeline/run`: the gateway's orchestration request and response |

Each folder has `<name>.schema.json` (JSON Schema, draft 2020-12) and `examples/<name>.json`. Most example
payloads still come from placeholder services (`model_version: "stub"`); effort-estimation's come from its
trained models. They show the shape, not results to rely on.

## How the pipeline uses them

The gateway (`gateway/app/orchestration.py`) runs requirements through the components in order and maps one
component's output into the next one's input. Most importantly, Component 4's `upstream` features come from:

| Component 4 feature | Taken from |
|---|---|
| `ambiguity_score`, `vague_term_count`, `missing_info_flag_count` | Component 1 `analysis` (`ambiguity.score`, `vagueness.count`, quality issues of type `missing_information`) |
| `ac_completeness_score`, `invest_compliance_flags` | Component 2 `refined-story` (`quality_scores.completeness`, `quality_scores.invest`) |
| `traceability_coverage_pct`, `unlinked_artifact_count`, `has_linked_tests` | Component 3 `coverage-response` items |

## Changing a contract

1. Change the Pydantic models in your service first, then regenerate the schema from them. For example, in
   `backend/` of the Requirement Quality repository:

   ```powershell
   ..\.venv\Scripts\python -c "import json; from app.schemas import RequirementAnalysis as M; print(json.dumps({'`$schema': 'https://json-schema.org/draft/2020-12/schema', **M.model_json_schema()}, indent=2))"
   ```

   Paste the output into your `.schema.json` file here and update the example.
2. If you rename or remove a field, or make one required, tell the components that read it (see the table above)
   and say so in the pull request description. Adding optional fields is safe.
3. CI runs `gateway/tests/test_contracts.py`: every example must match its schema, and `common/` must match the
   gateway's own models.
