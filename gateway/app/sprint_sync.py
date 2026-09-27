"""Sends a project's active or closed sprint to the effort service (PUT /api/v1/projects/{id}/sprints/{id} there).

The effort service keeps each team's sprint history for its predictions, and at a sprint's close records every
story's outcome against its prediction (FR19). The platform owns the sprints, so it sends the sprint as it is now
after every change; the service replaces its copy. A failure never undoes the platform's change: it is recorded on
the sprint, and the sprint page offers to send it again.
"""

from datetime import UTC, datetime
from urllib.parse import quote

import httpx2
from starlette.concurrency import run_in_threadpool

from app import db, tables
from app.config import get_settings


def _utc(value: datetime | None) -> str | None:
    if value is None:
        return None
    return (value if value.tzinfo else value.replace(tzinfo=UTC)).isoformat().replace("+00:00", "Z")


def sprint_record(session, project_id: str, sprint_id: str) -> dict | None:
    """The sprint as the effort service's sprint-record contract describes it; None while it is only planned."""
    sprint = session.get(tables.Sprint, (project_id, sprint_id))
    if sprint is None or sprint.status == "planned":
        return None
    items = session.query(tables.SprintItem).filter_by(project_id=project_id, sprint_id=sprint_id).all()
    stories = []
    for item in sorted(items, key=lambda entry: entry.story_id):
        story = session.get(tables.Story, (project_id, item.story_id))
        hours = None
        if story.started_at and story.resolved_at:
            hours = round(max((_aware(story.resolved_at) - _aware(story.started_at)).total_seconds(), 0) / 3600, 2)
        entry = {
            "story_id": item.story_id,
            "issue_type": story.issue_type,
            "committed_at": _utc(item.committed_at),
            "left_at": _utc(item.left_at),
            "points_at_commit": item.points_at_commit,
            "points_at_close": item.points_at_close,
            "done_in_sprint": item.done_in_sprint,
            "reopened": story.reopened,
            "started_at": _utc(story.started_at),
            "resolved_at": _utc(story.resolved_at),
            "hours_in_progress": hours,
        }
        stories.append({key: value for key, value in entry.items() if value is not None})
    record = {"name": sprint.name, "started_at": _utc(sprint.started_at), "planned_end": _utc(sprint.planned_end),
              "closed_at": _utc(sprint.closed_at), "stories": stories}
    return {key: value for key, value in record.items() if value is not None}


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=UTC)


def _build(project_id: str, sprint_id: str) -> dict | None:
    with db.SessionLocal() as session:
        return sprint_record(session, project_id, sprint_id)


def _mark(project_id: str, sprint_id: str, error: str | None) -> None:
    with db.SessionLocal() as session:
        sprint = session.get(tables.Sprint, (project_id, sprint_id))
        if sprint is None:
            return
        if error is None:
            sprint.effort_synced_at, sprint.effort_sync_error = datetime.now(UTC), None
        else:
            sprint.effort_sync_error = error
        session.commit()


def _problem(response: httpx2.Response) -> str:
    try:
        detail = response.json().get("detail")
    except ValueError:
        detail = None
    if isinstance(detail, dict):
        detail = detail.get("message")
    return f"The effort service answered {response.status_code}" + (f": {detail}" if isinstance(detail, str) else "")


async def push_sprint(client: httpx2.AsyncClient, project_id: str, sprint_id: str) -> str | None:
    """Send the sprint; returns None when the service took it, otherwise why not (also stored on the sprint)."""
    record = await run_in_threadpool(_build, project_id, sprint_id)
    if record is None:
        return None
    base = get_settings().component_urls()["effort-estimation"]
    url = f"{base}/api/v1/projects/{quote(project_id, safe='')}/sprints/{quote(sprint_id, safe='')}"
    try:
        response = await client.put(url, json=record)
        error = None if response.is_success else _problem(response)
    except httpx2.HTTPError:
        error = "The effort service could not be reached"
    await run_in_threadpool(_mark, project_id, sprint_id, error)
    return error
