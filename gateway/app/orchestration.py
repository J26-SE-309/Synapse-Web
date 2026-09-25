"""The orchestration engine: run requirements through the four components in pipeline order.

    requirement text -> (1) quality analysis -> (2) refined story + acceptance criteria
                     -> (3) traceability coverage -> (4) effort and sprint-risk prediction

Each stage's outputs become later stages' inputs; in particular the upstream quality,
acceptance-criteria and traceability scores are the features Component 4 predicts from.
A component that cannot be reached is skipped and reported instead of failing the run
(FR17 graceful degradation); later stages continue with what is available.
"""

import asyncio
from typing import Any

import httpx2
from pydantic import BaseModel, Field

from app.config import COMPONENTS

Payload = dict[str, Any]


class RequirementText(BaseModel):
    requirement_id: str
    text: str = Field(min_length=1)


class PipelineRequest(BaseModel):
    project_id: str
    sprint_id: str | None = None
    requirements: list[RequirementText] = Field(min_length=1, max_length=50)


class RequirementResult(BaseModel):
    requirement_id: str
    analysis: Payload | None = Field(description="Component 1 result (contracts/requirement-quality)")
    story: Payload | None = Field(description="Component 2 result (contracts/story-refinement)")
    coverage: Payload | None = Field(description="Component 3 result for this story (contracts/traceability)")
    prediction: Payload | None = Field(description="Component 4 result for this story (contracts/effort-estimation)")


class PipelineResponse(BaseModel):
    project_id: str
    results: list[RequirementResult]
    unavailable_components: list[str] = Field(
        description="Components that could not be reached; their stages were skipped"
    )


# ---- mapping between contracts ---------------------------------------------------------------


def story_id_for(requirement: RequirementText, story: Payload | None) -> str:
    return story["story_id"] if story else requirement.requirement_id


def acceptance_criteria_text(story: Payload | None) -> list[str]:
    if not story:
        return []
    return [f"Given {c['given']}, when {c['when']}, then {c['then']}" for c in story.get("acceptance_criteria", [])]


def trace_reference(requirement: RequirementText, story: Payload | None) -> Payload:
    """Component 3 input. A requirement that could not be refined is traced as written."""
    return {
        "story_id": story_id_for(requirement, story),
        "user_story": story["user_story"] if story else requirement.text,
        "acceptance_criteria": acceptance_criteria_text(story),
    }


def _quality_signals(analysis: Payload) -> Payload:
    return {
        "ambiguity_score": analysis["ambiguity"]["score"],
        "vague_term_count": analysis["vagueness"]["count"],
        "missing_info_flag_count": sum(
            1 for issue in analysis["quality"]["issues"] if issue["type"] == "missing_information"
        ),
    }


def _acceptance_criteria_signals(story: Payload) -> Payload:
    return {
        "ac_completeness_score": story["quality_scores"]["completeness"],
        "invest_compliance_flags": story["quality_scores"]["invest"],
    }


def _traceability_signals(coverage: Payload) -> Payload:
    return {
        "traceability_coverage_pct": coverage["coverage_pct"],
        "unlinked_artifact_count": coverage["unlinked_artifact_count"],
        "has_linked_tests": coverage["has_linked_tests"],
    }


def upstream_signals(analysis: Payload | None, story: Payload | None, coverage: Payload | None) -> Payload:
    """Component 4's upstream feature groups, taken from Components 1-3. Missing groups are left out."""
    signals: Payload = {}
    for payload, extract in (
        (analysis, _quality_signals),
        (story, _acceptance_criteria_signals),
        (coverage, _traceability_signals),
    ):
        if not payload:
            continue
        try:
            signals.update(extract(payload))
        except (KeyError, TypeError):
            continue  # A payload that breaks its contract contributes nothing; the others still count.
    return signals


def estimate_input(
    requirement: RequirementText, analysis: Payload | None, story: Payload | None, coverage: Payload | None
) -> Payload:
    """Component 4 input for one story."""
    return {
        "story_id": story_id_for(requirement, story),
        "title": (story["user_story"] if story else requirement.text)[:300],
        "description": requirement.text,
        "acceptance_criteria": acceptance_criteria_text(story),
        "upstream": upstream_signals(analysis, story, coverage),
    }


# ---- the pipeline ------------------------------------------------------------------------------


async def run_pipeline(request: PipelineRequest, client: httpx2.AsyncClient, urls: dict[str, str]) -> PipelineResponse:
    unavailable: set[str] = set()

    async def call(component: str, path: str, payload: Any) -> Any:
        try:
            response = await client.post(f"{urls[component]}/api/v1/{path}", json=payload)
            response.raise_for_status()
            return response.json()
        except (httpx2.HTTPError, ValueError):
            unavailable.add(component)
            return None

    requirements = request.requirements
    project = request.project_id

    # 1. Requirement quality: one batch call for all requirements.
    analyses = await call(
        "requirement-quality",
        "analyze/batch",
        [{"requirement_id": r.requirement_id, "project_id": project, "text": r.text} for r in requirements],
    )
    analysis_by_id = {a["requirement_id"]: a for a in analyses or []}

    # 2. Story refinement: one call per requirement, in parallel.
    stories = await asyncio.gather(
        *(
            call(
                "story-refinement",
                "refine",
                {"requirement_id": r.requirement_id, "project_id": project, "validated_requirement": r.text},
            )
            for r in requirements
        )
    )
    story_by_id = {r.requirement_id: story for r, story in zip(requirements, stories, strict=True) if story}

    # 3. Traceability: one call for every story.
    coverage = await call(
        "traceability",
        "coverage",
        {
            "project_id": project,
            "stories": [trace_reference(r, story_by_id.get(r.requirement_id)) for r in requirements],
        },
    )
    coverage_by_story = {item["story_id"]: item for item in (coverage or {}).get("items", [])}

    # 4. Effort and sprint risk: one call for the whole backlog, so sprint-level context is available.
    inputs = [
        estimate_input(
            r,
            analysis_by_id.get(r.requirement_id),
            story_by_id.get(r.requirement_id),
            coverage_by_story.get(story_id_for(r, story_by_id.get(r.requirement_id))),
        )
        for r in requirements
    ]
    estimate = await call(
        "effort-estimation", "estimate", {"project_id": project, "sprint_id": request.sprint_id, "stories": inputs}
    )
    prediction_by_story = {p["story_id"]: p for p in (estimate or {}).get("predictions", [])}

    results = []
    for r in requirements:
        story = story_by_id.get(r.requirement_id)
        story_id = story_id_for(r, story)
        results.append(
            RequirementResult(
                requirement_id=r.requirement_id,
                analysis=analysis_by_id.get(r.requirement_id),
                story=story,
                coverage=coverage_by_story.get(story_id),
                prediction=prediction_by_story.get(story_id),
            )
        )
    return PipelineResponse(
        project_id=project,
        results=results,
        unavailable_components=[c for c in COMPONENTS if c in unavailable],
    )
