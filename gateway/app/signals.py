"""What Components 1-3 report about a story (requirement quality, acceptance criteria and INVEST, traceability),
worked out by the platform until those components are connected through the pipeline.

Every story gets every signal, so no estimate is made without them. The rules read the story itself:
  - requirement quality: vague terms ("fast", "user-friendly", "etc."), a short description, no criteria;
  - acceptance criteria: how many there are, and whether they are written as Given / When / Then; INVEST flags
    from the links, the "so that" of a user story and the size;
  - traceability: the three traces the effort models know (an epic, any linked issue, linked tests), with tests
    counted as linked when the story has acceptance criteria to test against.
They are kept on the story with source "platform" and worked out again whenever the story changes. Signals a real
component sends (another source) are kept until the story's text changes.
"""

import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import tables

SOURCE = "platform"
VAGUE = ("etc", "user-friendly", "user friendly", "fast", "quickly", "simple", "intuitive", "nice", "better",
         "improve", "flexible", "as appropriate", "where possible", "tbd", "asap", "some", "usual", "properly")
SHORT_DESCRIPTION = 15  # words
_WORD = re.compile(r"[A-Za-z0-9']+")
_GHERKIN = re.compile(r"\bgiven\b.*\bwhen\b.*\bthen\b", re.IGNORECASE | re.DOTALL)


def _clip(value: float) -> float:
    return round(min(1.0, max(0.0, value)), 2)


def signals_for(story) -> dict:
    """The signals for a story (a table row or anything with the story's fields)."""
    criteria = list(story.acceptance_criteria or [])
    text = " ".join([story.title, story.description or "", *criteria]).lower()
    words = len(_WORD.findall(story.description or ""))
    vague = sum(len(re.findall(rf"\b{re.escape(term)}\b", text)) for term in VAGUE)
    user_story = text.startswith("as a") or " so that " in text
    gherkin = sum(1 for criterion in criteria if _GHERKIN.search(criterion))
    short = words < SHORT_DESCRIPTION
    missing = sum([short, not criteria, not user_story and story.issue_type in (None, "Story", "New Feature")])
    ambiguity = 0.05 + 0.1 * vague + 0.25 * short + 0.1 * (not criteria)
    if not criteria:
        completeness = 0.0
    else:
        completeness = 0.55 + 0.12 * min(len(criteria), 3) + 0.09 * min(gherkin, 1)
    tests = bool(criteria)
    linked = (story.blocked_by or 0) + (story.depends_on or 0) + (story.needed_by or 0) > 0
    traced = [story.epic is not None, linked, tests]
    return {
        "ambiguity_score": _clip(ambiguity),
        "vague_term_count": vague,
        "missing_info_flag_count": missing,
        "ac_completeness_score": _clip(completeness),
        "invest_compliance_flags": {
            "independent": (story.blocked_by or 0) == 0 and (story.depends_on or 0) == 0,
            "negotiable": True,
            "valuable": user_story,
            "estimable": ambiguity < 0.5,
            "small": story.story_points is None or story.story_points <= 8,
            "testable": bool(criteria),
        },
        "traceability_coverage_pct": round(sum(traced) / 3, 4),
        "unlinked_artifact_count": 3 - sum(traced),
        "has_linked_tests": tests,
        "source": SOURCE,
    }


def refresh(story: tables.Story, text_changed: bool = True) -> None:
    """Work the story's signals out again, unless a real component sent them and its text is unchanged."""
    current = story.upstream or {}
    if current and current.get("source") != SOURCE and not text_changed:
        return
    story.upstream = signals_for(story)


def fill(session: Session, project_id: str | None = None) -> int:
    """Signals for every story without any (of one project, or all); how many were filled."""
    query = select(tables.Story).where(tables.Story.upstream.is_(None))
    if project_id is not None:
        query = query.where(tables.Story.project_id == project_id)
    stories = list(session.scalars(query))
    for story in stories:
        story.upstream = signals_for(story)
    session.commit()
    return len(stories)
