"""The platform's backlog and sprints: every project's stories, and the sprints the team commits them to.

Sprint planning happens here, not in a component: the product owner and the team choose a sprint's stories; the
components give their opinion on that choice (the effort service estimates it from the sprint page). A sprint is
planned, then started (its stories are committed), then closed (stories not done go back to the backlog). Every
change to an active or closed sprint is sent to the effort service, which records outcomes and the team's history.
"""

import re
from collections.abc import Iterable
from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app import tables
from app.db import get_session
from app.http import get_http_client
from app.sprint_sync import push_sprint

router = APIRouter(tags=["backlog and sprints"])

IssueType = Literal["Story", "Task", "Bug", "Improvement", "New Feature"]
Priority = Literal["Blocker", "Critical", "Major", "Minor", "Trivial"]
StoryStatus = Literal["to_do", "in_progress", "done"]
SprintStatus = Literal["planned", "active", "closed"]
Criterion = Annotated[str, Field(min_length=1, max_length=1000)]
MAX_STORIES_PER_IMPORT = 200
# Ids travel in URLs and into every component's data: no spaces or slashes.
STORY_ID_PATTERN = SPRINT_ID_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9._-]*$"


class StoryCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    story_id: str | None = Field(default=None, min_length=1, max_length=200, pattern=STORY_ID_PATTERN,
                                 description="Empty: the next free id like PROJECT-7")
    title: str = Field(min_length=1, max_length=300)
    description: str = Field(default="", max_length=10000)
    acceptance_criteria: list[Criterion] = Field(default_factory=list, max_length=30)
    issue_type: IssueType | None = None
    priority: Priority | None = None
    story_points: float | None = Field(default=None, ge=0, le=1000, description="The team's estimate")
    epic: str | None = Field(default=None, max_length=200, description="The epic it belongs to, if any")
    blocked_by: int = Field(default=0, ge=0, le=1000, description="Open issues blocking it")
    depends_on: int = Field(default=0, ge=0, le=1000, description="Issues it needs first")
    needed_by: int = Field(default=0, ge=0, le=1000, description="Issues that need it first")


NOT_NULL = {"title", "description", "acceptance_criteria", "blocked_by", "depends_on", "needed_by", "status", "rank"}


class StoryUpdate(BaseModel):
    """Only the fields given change. sprint_id moves the story into that sprint, or with null back to the backlog."""

    model_config = ConfigDict(str_strip_whitespace=True)

    title: str | None = Field(default=None, min_length=1, max_length=300)
    description: str | None = Field(default=None, max_length=10000)
    acceptance_criteria: list[Criterion] | None = Field(default=None, max_length=30)
    issue_type: IssueType | None = None
    priority: Priority | None = None
    story_points: float | None = Field(default=None, ge=0, le=1000)
    epic: str | None = Field(default=None, max_length=200)
    blocked_by: int | None = Field(default=None, ge=0, le=1000)
    depends_on: int | None = Field(default=None, ge=0, le=1000)
    needed_by: int | None = Field(default=None, ge=0, le=1000)
    status: StoryStatus | None = None
    sprint_id: str | None = Field(default=None, max_length=100)
    rank: float | None = Field(default=None, description="Its new place: lower comes first (between two neighbours)")

    @model_validator(mode="after")
    def _required_stay_set(self):
        cleared = sorted(name for name in self.model_fields_set & NOT_NULL if getattr(self, name) is None)
        if cleared:
            raise ValueError(f"{', '.join(cleared)} cannot be empty")
        return self


class Story(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    project_id: str
    story_id: str
    title: str
    description: str
    acceptance_criteria: list[str]
    issue_type: IssueType | None
    priority: Priority | None
    story_points: float | None
    epic: str | None
    blocked_by: int
    depends_on: int
    needed_by: int
    status: StoryStatus
    rank: float = Field(description="Its place in the backlog and in its sprint: lower comes first")
    sprint_id: str | None = Field(description="The sprint it is in now; empty in the backlog")
    source: Literal["manual", "import", "refinement"]
    synthetic: bool = Field(description="Made-up data for development and demonstrations, never evidence")
    started_at: datetime | None
    resolved_at: datetime | None
    reopened: bool
    created_at: datetime
    updated_at: datetime


class SprintCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    sprint_id: str | None = Field(default=None, min_length=1, max_length=100, pattern=SPRINT_ID_PATTERN,
                                  description="Empty: the next free id like PROJECT-S3")
    name: str | None = Field(default=None, min_length=1, max_length=80, description="Empty: Sprint 3")
    goal: str = Field(default="", max_length=1000)
    length_days: int = Field(default=14, ge=1, le=60)
    capacity_points: float | None = Field(default=None, gt=0, le=10000,
                                          description="Empty: the effort service uses the team's velocity")


class SprintUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=1, max_length=80)
    goal: str | None = Field(default=None, max_length=1000)
    length_days: int | None = Field(default=None, ge=1, le=60)
    capacity_points: float | None = Field(default=None, gt=0, le=10000)

    @model_validator(mode="after")
    def _required_stay_set(self):
        cleared = sorted(name for name in self.model_fields_set & {"name", "goal", "length_days"}
                         if getattr(self, name) is None)
        if cleared:
            raise ValueError(f"{', '.join(cleared)} cannot be empty")
        return self


class SprintItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    story_id: str
    committed_at: datetime | None = Field(description="When it was committed: the start, or when it was added")
    added_mid_sprint: bool
    points_at_commit: float | None
    left_at: datetime | None = Field(description="When it was taken out before the end")
    points_at_close: float | None
    done_in_sprint: bool | None = Field(description="Known at the close")


class EffortSync(BaseModel):
    status: Literal["not_sent", "sent", "failed"] = Field(
        description="not_sent: a planned sprint is not sent; failed: the last change did not reach the service")
    sent_at: datetime | None
    error: str | None


class Sprint(BaseModel):
    project_id: str
    sprint_id: str
    name: str
    goal: str
    status: SprintStatus
    length_days: int
    capacity_points: float | None
    started_at: datetime | None
    planned_end: datetime | None
    closed_at: datetime | None
    created_at: datetime
    items: list[SprintItem] = Field(description="Every story that has been in the sprint, including ones taken out")
    effort_sync: EffortSync


class StoryImport(BaseModel):
    stories: list[StoryCreate] = Field(min_length=1, max_length=MAX_STORIES_PER_IMPORT)
    synthetic: bool = Field(default=False, description="Made-up stories: labelled so they are never evidence")
    sprint: SprintCreate | None = Field(default=None, description="Also plan a new sprint with these stories")


class ImportResult(BaseModel):
    stories: list[Story]
    sprint: Sprint | None


DbSession = Annotated[Session, Depends(get_session)]


def _unavailable() -> HTTPException:
    return HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "The platform database is not reachable")


def _conflict(message: str) -> HTTPException:
    return HTTPException(status.HTTP_409_CONFLICT, message)


def _now() -> datetime:
    return datetime.now(UTC)


def _project(session: Session, project_id: str) -> tables.Project:
    project = session.get(tables.Project, project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No project '{project_id}'")
    return project


def _story(session: Session, project_id: str, story_id: str) -> tables.Story:
    story = session.get(tables.Story, (project_id, story_id))
    if story is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No story '{story_id}' in project '{project_id}'")
    return story


def _sprint(session: Session, project_id: str, sprint_id: str) -> tables.Sprint:
    sprint = session.get(tables.Sprint, (project_id, sprint_id))
    if sprint is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No sprint '{sprint_id}' in project '{project_id}'")
    return sprint


def _items(session: Session, project_id: str, sprint_id: str) -> list[tables.SprintItem]:
    items = session.scalars(select(tables.SprintItem).filter_by(project_id=project_id, sprint_id=sprint_id))
    return sorted(items, key=lambda item: _natural(item.story_id))


def _next_id(existing: Iterable[str], prefix: str) -> tuple[str, int]:
    pattern = re.compile(rf"^{re.escape(prefix)}(\d+)$")
    number = max((int(found.group(1)) for value in existing if (found := pattern.match(value))), default=0) + 1
    return f"{prefix}{number}", number


def _natural(value: str) -> list:
    """TUTOR-2 before TUTOR-10."""
    return [(0, int(part), "") if part.isdigit() else (1, 0, part) for part in re.split(r"(\d+)", value)]


def _sprint_out(session: Session, sprint: tables.Sprint) -> Sprint:
    if sprint.status == "planned" or (sprint.effort_synced_at is None and sprint.effort_sync_error is None):
        sync = EffortSync(status="not_sent", sent_at=None, error=None)
    else:
        sync = EffortSync(status="failed" if sprint.effort_sync_error else "sent", sent_at=sprint.effort_synced_at,
                          error=sprint.effort_sync_error)
    fields = {name: getattr(sprint, name) for name in Sprint.model_fields if name not in ("items", "effort_sync")}
    items = [SprintItem.model_validate(item) for item in _items(session, sprint.project_id, sprint.sprint_id)]
    return Sprint(**fields, items=items, effort_sync=sync)


def _last_rank(session: Session, project_id: str) -> float:
    return session.scalar(select(func.max(tables.Story.rank)).filter_by(project_id=project_id)) or 0.0


def _new_story(session: Session, project_id: str, request: StoryCreate, source: str, synthetic: bool,
               taken: set[str], rank: float) -> tables.Story:
    story_id = request.story_id or _next_id(taken, f"{project_id}-")[0]
    if story_id in taken:
        raise _conflict(f"A story with the id '{story_id}' already exists in this project")
    taken.add(story_id)
    story = tables.Story(project_id=project_id, **request.model_dump(exclude={"story_id"}), story_id=story_id,
                         status="to_do", source=source, synthetic=synthetic, reopened=False, rank=rank)
    session.add(story)
    return story


def _new_sprint(session: Session, project_id: str, request: SprintCreate) -> tables.Sprint:
    existing = list(session.scalars(select(tables.Sprint.sprint_id).filter_by(project_id=project_id)))
    automatic, number = _next_id(existing, f"{project_id}-S")
    sprint_id = request.sprint_id or automatic
    if sprint_id in existing:
        raise _conflict(f"A sprint with the id '{sprint_id}' already exists in this project")
    sprint = tables.Sprint(project_id=project_id, sprint_id=sprint_id,
                           name=request.name or f"Sprint {number if not request.sprint_id else len(existing) + 1}",
                           goal=request.goal, status="planned", length_days=request.length_days,
                           capacity_points=request.capacity_points)
    session.add(sprint)
    return sprint


def _move(session: Session, story: tables.Story, target: tables.Sprint | None, now: datetime) -> set[str]:
    """Put a story into a sprint, or back into the backlog. Returns the started sprints this changed."""
    changed: set[str] = set()
    if (target.sprint_id if target else None) == story.sprint_id:
        return changed
    if target is not None and target.status == "closed":
        raise _conflict(f"Sprint '{target.sprint_id}' is closed; stories can only be added to a planned or active one")
    if story.sprint_id is not None:
        current = session.get(tables.Sprint, (story.project_id, story.sprint_id))
        item = session.get(tables.SprintItem, (story.project_id, story.sprint_id, story.story_id))
        if current.status == "planned" and item is not None:
            session.delete(item)
        elif current.status == "active" and item is not None:
            item.left_at = now
            changed.add(current.sprint_id)
        # A closed sprint keeps its record of the story as it was.
    if target is not None:
        item = session.get(tables.SprintItem, (story.project_id, target.sprint_id, story.story_id))
        if item is None:
            item = tables.SprintItem(project_id=story.project_id, sprint_id=target.sprint_id,
                                     story_id=story.story_id, added_mid_sprint=False)
            session.add(item)
        item.left_at = None
        if target.status == "active":
            item.committed_at = item.committed_at or now
            item.added_mid_sprint = True
            item.points_at_commit = story.story_points
            changed.add(target.sprint_id)
    story.sprint_id = target.sprint_id if target else None
    return changed


def _set_status(story: tables.Story, new: str, now: datetime) -> None:
    if new == story.status:
        return
    if story.status == "done":  # back from done: reopened (R6)
        story.reopened, story.resolved_at = True, None
    if new in ("in_progress", "done") and story.started_at is None:
        story.started_at = now
    if new == "done":
        story.resolved_at = now
    story.status = new


def _push(background: BackgroundTasks, request: Request, project_id: str, sprint_ids: Iterable[str]) -> None:
    client = get_http_client(request)
    for sprint_id in sorted(set(sprint_ids)):
        background.add_task(push_sprint, client, project_id, sprint_id)


# ------------------------------------------------------------------------------------------------------ stories


@router.get("/projects/{project_id}/stories", response_model=list[Story])
def list_stories(project_id: str, session: DbSession) -> list[Story]:
    """Every story of the project in backlog order (rank); each says which sprint it is in (none: the backlog)."""
    try:
        _project(session, project_id)
        rows = session.scalars(select(tables.Story).filter_by(project_id=project_id))
        return [Story.model_validate(row) for row in sorted(rows, key=lambda row: (row.rank, row.created_at,
                                                                                    _natural(row.story_id)))]
    except SQLAlchemyError:
        raise _unavailable() from None


@router.post("/projects/{project_id}/stories", response_model=Story, status_code=status.HTTP_201_CREATED)
def create_story(project_id: str, request: StoryCreate, session: DbSession) -> Story:
    try:
        _project(session, project_id)
        taken = set(session.scalars(select(tables.Story.story_id).filter_by(project_id=project_id)))
        story = _new_story(session, project_id, request, "manual", False, taken, _last_rank(session, project_id) + 1)
        session.commit()
        return Story.model_validate(story)
    except SQLAlchemyError:
        raise _unavailable() from None


@router.post("/projects/{project_id}/stories/import", response_model=ImportResult,
             status_code=status.HTTP_201_CREATED)
def import_stories(project_id: str, request: StoryImport, session: DbSession) -> ImportResult:
    """Add a whole backlog at once (all or nothing), optionally planning a new sprint with it."""
    try:
        _project(session, project_id)
        taken = set(session.scalars(select(tables.Story.story_id).filter_by(project_id=project_id)))
        last = _last_rank(session, project_id)
        stories = [_new_story(session, project_id, story, "import", request.synthetic, taken, last + index)
                   for index, story in enumerate(request.stories, start=1)]
        sprint = _new_sprint(session, project_id, request.sprint) if request.sprint else None
        session.flush()
        if sprint is not None:
            for story in stories:
                _move(session, story, sprint, _now())
        session.commit()
        return ImportResult(stories=[Story.model_validate(story) for story in stories],
                            sprint=_sprint_out(session, sprint) if sprint else None)
    except SQLAlchemyError:
        raise _unavailable() from None


@router.get("/projects/{project_id}/stories/{story_id}", response_model=Story)
def get_story(project_id: str, story_id: str, session: DbSession) -> Story:
    try:
        return Story.model_validate(_story(session, project_id, story_id))
    except SQLAlchemyError:
        raise _unavailable() from None


@router.patch("/projects/{project_id}/stories/{story_id}", response_model=Story)
def update_story(project_id: str, story_id: str, update: StoryUpdate, request: Request, background: BackgroundTasks,
                 session: DbSession) -> Story:
    """Edit a story, change its status, or move it: sprint_id puts it into a planned or active sprint (added to an
    active one, it counts as added mid-sprint), null takes it back to the backlog."""
    try:
        story = _story(session, project_id, story_id)
        now, changed = _now(), set()
        values = update.model_dump(exclude_unset=True)
        moving, target_id = "sprint_id" in values, values.pop("sprint_id", None)
        new_status = values.pop("status", None)
        for name, value in values.items():  # first, so a story added to an active sprint commits its new points
            setattr(story, name, value)
        if moving:
            changed |= _move(session, story, _sprint(session, project_id, target_id) if target_id else None, now)
        if new_status is not None:
            _set_status(story, new_status, now)
        session.flush()
        if story.sprint_id is not None and session.get(tables.Sprint, (project_id, story.sprint_id)).status == "active":
            changed.add(story.sprint_id)  # its points, status or details changed during the sprint
        session.commit()
        _push(background, request, project_id, changed)
        return Story.model_validate(story)
    except SQLAlchemyError:
        raise _unavailable() from None


@router.delete("/projects/{project_id}/stories/{story_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_story(project_id: str, story_id: str, session: DbSession) -> Response:
    """Delete a story that was never in a started sprint (those are part of a sprint's history)."""
    try:
        story = _story(session, project_id, story_id)
        items = list(session.scalars(select(tables.SprintItem).filter_by(project_id=project_id, story_id=story_id)))
        started = [item.sprint_id for item in items
                   if session.get(tables.Sprint, (project_id, item.sprint_id)).status != "planned"]
        if started:
            raise _conflict(f"'{story_id}' was in sprint {', '.join(sorted(started))}, so it stays in the history; "
                            "move it back to the backlog instead")
        for item in items:
            session.delete(item)
        session.delete(story)
        session.commit()
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except SQLAlchemyError:
        raise _unavailable() from None


# ------------------------------------------------------------------------------------------------------ sprints


@router.get("/projects/{project_id}/sprints", response_model=list[Sprint])
def list_sprints(project_id: str, session: DbSession) -> list[Sprint]:
    """Every sprint of the project, newest first."""
    try:
        _project(session, project_id)
        rows = session.scalars(select(tables.Sprint).filter_by(project_id=project_id)
                               .order_by(tables.Sprint.created_at.desc(), tables.Sprint.sprint_id.desc()))
        return [_sprint_out(session, row) for row in rows]
    except SQLAlchemyError:
        raise _unavailable() from None


@router.post("/projects/{project_id}/sprints", response_model=Sprint, status_code=status.HTTP_201_CREATED)
def create_sprint(project_id: str, request: SprintCreate, session: DbSession) -> Sprint:
    try:
        _project(session, project_id)
        sprint = _new_sprint(session, project_id, request)
        session.commit()
        return _sprint_out(session, sprint)
    except SQLAlchemyError:
        raise _unavailable() from None


@router.get("/projects/{project_id}/sprints/{sprint_id}", response_model=Sprint)
def get_sprint(project_id: str, sprint_id: str, session: DbSession) -> Sprint:
    try:
        return _sprint_out(session, _sprint(session, project_id, sprint_id))
    except SQLAlchemyError:
        raise _unavailable() from None


@router.patch("/projects/{project_id}/sprints/{sprint_id}", response_model=Sprint)
def update_sprint(project_id: str, sprint_id: str, update: SprintUpdate, request: Request,
                  background: BackgroundTasks, session: DbSession) -> Sprint:
    """Rename a sprint or change its goal, length or capacity (not once it is closed)."""
    try:
        sprint = _sprint(session, project_id, sprint_id)
        if sprint.status == "closed":
            raise _conflict(f"Sprint '{sprint_id}' is closed")
        for name, value in update.model_dump(exclude_unset=True).items():
            setattr(sprint, name, value)
        if sprint.status == "active" and "length_days" in update.model_fields_set:
            sprint.planned_end = sprint.started_at + timedelta(days=sprint.length_days)
        session.commit()
        if sprint.status == "active":
            _push(background, request, project_id, [sprint_id])
        return _sprint_out(session, sprint)
    except SQLAlchemyError:
        raise _unavailable() from None


@router.delete("/projects/{project_id}/sprints/{sprint_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sprint(project_id: str, sprint_id: str, session: DbSession) -> Response:
    """Delete a planned sprint; its stories go back to the backlog. Started sprints are history and stay."""
    try:
        sprint = _sprint(session, project_id, sprint_id)
        if sprint.status != "planned":
            raise _conflict(f"Sprint '{sprint_id}' has started, so it stays in the history")
        for story in session.scalars(select(tables.Story).filter_by(project_id=project_id, sprint_id=sprint_id)):
            story.sprint_id = None
        for item in _items(session, project_id, sprint_id):
            session.delete(item)
        session.flush()
        session.delete(sprint)
        session.commit()
        return Response(status_code=status.HTTP_204_NO_CONTENT)
    except SQLAlchemyError:
        raise _unavailable() from None


@router.post("/projects/{project_id}/sprints/{sprint_id}/start", response_model=Sprint)
def start_sprint(project_id: str, sprint_id: str, request: Request, background: BackgroundTasks,
                 session: DbSession) -> Sprint:
    """Commit the team to the sprint's stories. A project runs one sprint at a time."""
    try:
        sprint = _sprint(session, project_id, sprint_id)
        if sprint.status != "planned":
            raise _conflict(f"Sprint '{sprint_id}' has already started")
        running = session.scalars(select(tables.Sprint.sprint_id).filter_by(project_id=project_id, status="active"))
        if (active := running.first()) is not None:
            raise _conflict(f"Sprint '{active}' is still running; close it first")
        items = [item for item in _items(session, project_id, sprint_id) if item.left_at is None]
        if not items:
            raise _conflict("Add at least one story before starting the sprint")
        now = _now()
        sprint.status, sprint.started_at = "active", now
        sprint.planned_end = now + timedelta(days=sprint.length_days)
        for item in items:
            item.committed_at = now
            item.points_at_commit = session.get(tables.Story, (project_id, item.story_id)).story_points
        session.commit()
        _push(background, request, project_id, [sprint_id])
        return _sprint_out(session, sprint)
    except SQLAlchemyError:
        raise _unavailable() from None


@router.post("/projects/{project_id}/sprints/{sprint_id}/close", response_model=Sprint)
def close_sprint(project_id: str, sprint_id: str, request: Request, background: BackgroundTasks,
                 session: DbSession) -> Sprint:
    """End the sprint: each story's outcome is fixed, and stories not done go back to the backlog."""
    try:
        sprint = _sprint(session, project_id, sprint_id)
        if sprint.status != "active":
            raise _conflict(f"Only an active sprint can be closed; '{sprint_id}' is {sprint.status}")
        now = _now()
        sprint.status, sprint.closed_at = "closed", now
        for item in _items(session, project_id, sprint_id):
            if item.left_at is not None:
                continue
            story = session.get(tables.Story, (project_id, item.story_id))
            item.done_in_sprint = story.status == "done"
            item.points_at_close = story.story_points
            if not item.done_in_sprint:
                story.sprint_id = None
        session.commit()
        _push(background, request, project_id, [sprint_id])
        return _sprint_out(session, sprint)
    except SQLAlchemyError:
        raise _unavailable() from None


@router.post("/projects/{project_id}/sprints/{sprint_id}/sync", response_model=Sprint)
async def sync_sprint(project_id: str, sprint_id: str, request: Request, session: DbSession) -> Sprint:
    """Send a started sprint to the effort service again (after it was unreachable)."""
    try:
        sprint = _sprint(session, project_id, sprint_id)
        if sprint.status == "planned":
            raise _conflict("A planned sprint is sent when it starts")
    except SQLAlchemyError:
        raise _unavailable() from None
    await push_sprint(get_http_client(request), project_id, sprint_id)
    try:
        session.expire_all()
        return _sprint_out(session, _sprint(session, project_id, sprint_id))
    except SQLAlchemyError:
        raise _unavailable() from None
