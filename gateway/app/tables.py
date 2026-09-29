"""The gateway's own tables, in the platform database. Change them with a migration (app/migrations)."""

from datetime import UTC, datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, ForeignKeyConstraint, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


def _now() -> datetime:
    return datetime.now(UTC)


class Project(Base):
    """A project of the platform: one team's backlog and sprints. Every component keys its data by the id."""

    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    description: Mapped[str] = mapped_column(Text, default="")
    # "platform" for projects people create; "tawos" and "synthetic" mark development data (removable).
    data_source: Mapped[str] = mapped_column(String(20), default="platform")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Sprint(Base):
    """A sprint of a project: planned, then active (started), then closed. One project has one active sprint."""

    __tablename__ = "sprints"

    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True)
    sprint_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    goal: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(10), default="planned")  # planned, active, closed
    length_days: Mapped[int] = mapped_column(Integer, default=14)
    capacity_points: Mapped[float | None] = mapped_column(Float, nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    planned_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # The last time the sprint was sent to the effort service (it records outcomes and the team's history), or why
    # that failed; an active or closed sprint is sent after every change.
    effort_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    effort_sync_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)


class Story(Base):
    """A backlog item of a project, with everything the components read about it."""

    __tablename__ = "stories"
    __table_args__ = (
        ForeignKeyConstraint(["project_id", "sprint_id"], ["sprints.project_id", "sprints.sprint_id"]),
    )

    project_id: Mapped[str] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True)
    story_id: Mapped[str] = mapped_column(String(200), primary_key=True)
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str] = mapped_column(Text, default="")
    acceptance_criteria: Mapped[list[str]] = mapped_column(JSON, default=list)
    issue_type: Mapped[str | None] = mapped_column(String(20), nullable=True)
    priority: Mapped[str | None] = mapped_column(String(20), nullable=True)
    story_points: Mapped[float | None] = mapped_column(Float, nullable=True)  # the team's estimate
    epic: Mapped[str | None] = mapped_column(String(200), nullable=True)
    blocked_by: Mapped[int] = mapped_column(Integer, default=0)  # open issues blocking it
    depends_on: Mapped[int] = mapped_column(Integer, default=0)  # issues it needs first
    needed_by: Mapped[int] = mapped_column(Integer, default=0)  # issues that need it first
    status: Mapped[str] = mapped_column(String(12), default="to_do")  # to_do, in_progress, done
    # Its place in the backlog (and in a sprint): lower comes first. A story dropped between two others takes a
    # rank between theirs, so reordering changes one row.
    rank: Mapped[float] = mapped_column(Float, default=0.0)
    # The sprint it is in now: none in the backlog; a story done in a sprint stays with that sprint.
    sprint_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    source: Mapped[str] = mapped_column(String(12), default="manual")  # manual, import, refinement
    synthetic: Mapped[bool] = mapped_column(Boolean, default=False)  # made-up data, never evidence
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reopened: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, onupdate=_now)


class SprintItem(Base):
    """A story's time in a sprint. Kept when the story leaves or spills over, so every sprint keeps its history."""

    __tablename__ = "sprint_items"
    __table_args__ = (
        ForeignKeyConstraint(["project_id", "sprint_id"], ["sprints.project_id", "sprints.sprint_id"],
                             ondelete="CASCADE"),
        ForeignKeyConstraint(["project_id", "story_id"], ["stories.project_id", "stories.story_id"],
                             ondelete="CASCADE"),
    )

    project_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    sprint_id: Mapped[str] = mapped_column(String(100), primary_key=True)
    story_id: Mapped[str] = mapped_column(String(200), primary_key=True)
    committed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)  # set at start
    added_mid_sprint: Mapped[bool] = mapped_column(Boolean, default=False)
    points_at_commit: Mapped[float | None] = mapped_column(Float, nullable=True)
    left_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    points_at_close: Mapped[float | None] = mapped_column(Float, nullable=True)
    done_in_sprint: Mapped[bool | None] = mapped_column(Boolean, nullable=True)  # known at the close
