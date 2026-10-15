"""Synthetic data for a project's demonstrations: what Components 1-3 would say about its stories, and a few closed
sprints before its first real one, so the effort service has the team history it needs.

Components 1-3 do not send their signals to the platform yet, and a new project has no past sprints, so the
effort estimates of a demo project lack both: their "What the models had" list shows the groups as reduced, and
the confidence stays low. This module makes up both, clearly labelled:
  - signals: each story's upstream signals, worked out from its own text and links by simple rules with a little
    seeded noise, with source "synthetic" (the effort service then reports the groups as synthetic, not as a
    component's);
  - history: closed sprints named "Synthetic sprint N" with made-up, finished stories (synthetic = true), placed
    before the project's first sprint, then sent to the effort service like any sprint.
Made-up data is for development and demos only, never evidence (ML guide 7.2; the proposal's Appendix H).
`python -m app.devdata` runs it (synthetic-signals, synthetic-history, remove-synthetic).
"""

import random
import re
import zlib
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app import tables

SOURCE = "synthetic"
SPRINT_MARK = "-SYN-S"  # synthetic sprint ids: PROJECT-SYN-S1, PROJECT-SYN-S2, ...
VAGUE = ("etc", "user-friendly", "user friendly", "fast", "quickly", "simple", "intuitive", "nice", "better",
         "improve", "flexible", "as appropriate", "where possible", "tbd", "asap", "some", "usual", "properly")
_WORD = re.compile(r"[A-Za-z0-9']+")


def _rng(*parts: str) -> random.Random:
    """The same numbers for the same story every time."""
    return random.Random(zlib.crc32("|".join(parts).encode("utf-8")))


def _clip(value: float) -> float:
    return round(min(1.0, max(0.0, value)), 2)


def signals_for(story: tables.Story) -> dict:
    """What Components 1-3 might report for the story: a vague, short story without criteria scores badly, a clear
    user story with Given / When / Then criteria well."""
    rng = _rng(story.project_id, story.story_id)
    criteria = list(story.acceptance_criteria or [])
    text = " ".join([story.title, story.description or "", *criteria]).lower()
    words = len(_WORD.findall(story.description or ""))
    vague = sum(len(re.findall(rf"\b{re.escape(term)}\b", text)) for term in VAGUE)
    user_story = text.startswith("as a") or " so that " in text
    gherkin = sum(1 for c in criteria if re.search(r"\bgiven\b.*\bwhen\b.*\bthen\b", c, re.IGNORECASE | re.DOTALL))
    missing = sum([words < 15, not criteria, not user_story and story.issue_type in (None, "Story", "New Feature")])
    ambiguity = 0.12 + 0.1 * vague + (0.25 if words < 15 else 0.0) + 0.08 * (not criteria) + rng.uniform(-0.06, 0.06)
    completeness = 0.0 if not criteria else 0.45 + 0.15 * len(criteria) + 0.1 * (gherkin > 0)
    completeness += rng.uniform(-0.08, 0.08) if criteria else rng.uniform(0, 0.05)
    tests = rng.random() < (0.65 if criteria else 0.2)
    linked = (story.blocked_by + story.depends_on + story.needed_by) > 0
    traced = [story.epic is not None, linked, tests]
    return {
        "ambiguity_score": _clip(ambiguity),
        "vague_term_count": vague,
        "missing_info_flag_count": missing,
        "ac_completeness_score": _clip(completeness),
        "invest_compliance_flags": {
            "independent": story.blocked_by == 0 and story.depends_on == 0,
            "negotiable": True,
            "valuable": user_story,
            "estimable": ambiguity < 0.5,
            "small": story.story_points is None or story.story_points <= 8,
            "testable": bool(criteria) or tests,
        },
        "traceability_coverage_pct": round(sum(traced) / 3, 4),
        "unlinked_artifact_count": 3 - sum(traced),
        "has_linked_tests": tests,
        "source": SOURCE,
    }


def add_signals(session: Session, project_id: str, replace: bool = False) -> int:
    """Synthetic signals for the project's stories that have none (all of them with replace); how many changed.
    Stories with signals from a real component are never touched."""
    changed = 0
    for story in session.scalars(select(tables.Story).filter_by(project_id=project_id)):
        current = story.upstream or {}
        if current and (current.get("source") != SOURCE or not replace):
            continue
        story.upstream = signals_for(story)
        changed += 1
    session.commit()
    return changed


# ------------------------------------------------------------------------------------------- sprint history

# A small team building a task-management app: the work before the project's first real sprint.
HISTORY_STORIES = [
    ("Set up the repository, coding standards and the development environment", "Task", 2),
    ("Design the database tables for users, teams and tasks", "Task", 3),
    ("As a team member I want to see my tasks in a list so that I know what to work on", "Story", 3),
    ("As a team member I want to mark a task as done so that the team sees my progress", "Story", 2),
    ("As a team lead I want to assign a task to a team member so that work is shared out", "Story", 5),
    ("Landing page with the product's main features", "New Feature", 2),
    ("As a team member I want to set a task's priority so that urgent work comes first", "Story", 3),
    ("As a team member I want to filter tasks by status so that I find open work quickly", "Story", 3),
    ("Tasks list does not refresh after a task is edited", "Bug", 1),
    ("As a team member I want to comment on a task so that we discuss it in one place", "Story", 5),
    ("As a user I want a profile page with my name and photo so that teammates recognise me", "Story", 3),
    ("Validate task titles and show clear error messages", "Improvement", 2),
    ("As a team member I want to attach a file to a task so that the details are with it", "Story", 5),
    ("As a team member I want to search tasks by title so that I find one without scrolling", "Story", 3),
    ("Task due dates are saved one day early for some users", "Bug", 2),
    ("Accessibility review of the task forms (labels, focus, contrast)", "Task", 3),
    ("As a team lead I want to archive finished tasks so that the board stays readable", "Story", 3),
    ("Add pagination to the tasks API", "Improvement", 2),
    ("As a team member I want to edit a task's description so that it stays up to date", "Story", 2),
    ("As a team lead I want to see how many tasks each member has so that nobody is overloaded", "Story", 5),
    ("Speed up the tasks list query for large teams", "Improvement", 3),
    ("As a team member I want keyboard shortcuts for common actions so that I work faster", "Story", 3),
    ("Write the user guide for the first release", "Task", 2),
    ("Deleted tasks still appear in search results", "Bug", 1),
    ("As a team lead I want to rename my team so that the name matches our department", "Story", 1),
    ("Set up error monitoring for the web app", "Task", 2),
    ("As a team member I want to duplicate a task so that similar work is quick to add", "Story", 2),
    ("Prepare the demo data and the release checklist", "Task", 2),
]
PRIORITY = ("Major", "Major", "Minor", "Critical", "Major", "Trivial")


def _history_plan(sprints: int) -> list[list[tuple[int, bool, float | None]]]:
    """Per sprint, its stories as (index into HISTORY_STORIES, done in the sprint, points at close if re-estimated).
    A story not done is carried into the next sprint and finished there; the last sprint finishes everything."""
    per_sprint = len(HISTORY_STORIES) // sprints
    plan, carried = [], []
    for number in range(sprints):
        own = list(range(number * per_sprint, (number + 1) * per_sprint))
        entries = [(index, True, None) for index in carried + own]
        carried = []
        if number < sprints - 1:  # one or two stories spill over (about 1 in 6, as in a typical team)
            spill = [len(entries) - 1] + ([len(entries) - 3] if number % 2 == 0 else [])
            for position in spill:
                index = entries[position][0]
                entries[position] = (index, False, None)
                carried.append(index)
        if number == 1:  # one story turned out bigger than planned
            index, done, _ = entries[1]
            entries[1] = (index, done, HISTORY_STORIES[index][2] + 2)
        plan.append(entries)
    return plan


def add_history(session: Session, project_id: str, sprints: int = 4, length_days: int = 14) -> list[str]:
    """Closed synthetic sprints just before the project's first sprint (or ending today); their ids, oldest first.
    Nothing is added when the project already has synthetic sprints."""
    existing = list(session.scalars(select(tables.Sprint).filter_by(project_id=project_id)))
    if any(SPRINT_MARK in sprint.sprint_id for sprint in existing):
        return []
    starts = [_aware(s.started_at) for s in existing if s.started_at is not None]
    end = min(starts) if starts else datetime.now(UTC).replace(microsecond=0)
    first = end - timedelta(days=length_days * sprints)
    taken = set(session.scalars(select(tables.Story.story_id).filter_by(project_id=project_id)))
    rank = min([*session.scalars(select(tables.Story.rank).filter_by(project_id=project_id)), 1.0]) - len(
        HISTORY_STORIES) - 1
    stories: dict[int, tables.Story] = {}
    ids = []
    for number, entries in enumerate(_history_plan(sprints), start=1):
        start = first + timedelta(days=length_days * (number - 1))
        close = start + timedelta(days=length_days, hours=-2)
        sprint_id = f"{project_id}{SPRINT_MARK}{number}"
        session.add(tables.Sprint(
            project_id=project_id, sprint_id=sprint_id, name=f"Synthetic sprint {number}", status="closed",
            goal="Made-up past sprint for development and demos (not evidence).", length_days=length_days,
            capacity_points=None, started_at=start, planned_end=start + timedelta(days=length_days),
            closed_at=close, created_at=start))
        session.flush()
        for position, (index, done, new_points) in enumerate(entries):
            rng = _rng(project_id, "history", str(index))
            title, issue_type, points = HISTORY_STORIES[index]
            if index not in stories:
                story_id = f"{project_id}-SYN-{index + 1}"
                while story_id in taken:
                    story_id += "x"
                taken.add(story_id)
                rank += 1
                stories[index] = tables.Story(
                    project_id=project_id, story_id=story_id, title=title, issue_type=issue_type,
                    description="Made-up story of the synthetic sprint history.", acceptance_criteria=[],
                    priority=PRIORITY[index % len(PRIORITY)], story_points=points,
                    epic="Task basics" if issue_type == "Story" else None, status="done", source="import",
                    synthetic=True, reopened=index == 9, rank=rank, created_at=start - timedelta(days=3))
                session.add(stories[index])
            story = stories[index]
            story.sprint_id = sprint_id
            if new_points is not None:
                story.story_points = new_points
            session.flush()
            begun = start + timedelta(days=min(length_days - 3, 1 + position * 1.5), hours=rng.randint(1, 6))
            story.started_at = story.started_at or begun
            if done:
                story.resolved_at = begun + timedelta(days=rng.uniform(1, 3) * max(1, story.story_points or 1) / 3)
                story.resolved_at = min(story.resolved_at, close - timedelta(hours=1))
            session.add(tables.SprintItem(
                project_id=project_id, sprint_id=sprint_id, story_id=story.story_id, committed_at=start,
                added_mid_sprint=False, points_at_commit=points, left_at=None,
                points_at_close=story.story_points, done_in_sprint=done))
        ids.append(sprint_id)
    session.commit()
    return ids


def remove(session: Session, project_id: str) -> tuple[list[str], int, int]:
    """Take the synthetic sprints, their stories and the synthetic signals out again:
    (sprint ids removed, stories removed, stories whose signals were cleared)."""
    sprints = [s for s in session.scalars(select(tables.Sprint).filter_by(project_id=project_id))
               if SPRINT_MARK in s.sprint_id]
    sprint_ids = [s.sprint_id for s in sprints]
    doomed = [story for story in session.scalars(select(tables.Story).filter_by(project_id=project_id))
              if story.synthetic and story.sprint_id in sprint_ids]
    session.execute(delete(tables.SprintItem).where(tables.SprintItem.project_id == project_id,
                                                    tables.SprintItem.sprint_id.in_(sprint_ids)))
    for story in doomed:
        session.delete(story)
    session.flush()
    for sprint in sprints:
        session.delete(sprint)
    removed = len(doomed)
    cleared = 0
    for story in session.scalars(select(tables.Story).filter_by(project_id=project_id)):
        if (story.upstream or {}).get("source") == SOURCE:
            story.upstream = None
            cleared += 1
    session.commit()
    return sprint_ids, removed, cleared


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=UTC)
