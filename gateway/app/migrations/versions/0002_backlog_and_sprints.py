"""The platform's backlog and sprints

Revision ID: 0002
Revises: 0001
Created: 2026-09-27
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "sprints",
        sa.Column("project_id", sa.String(length=32), sa.ForeignKey("projects.id", ondelete="CASCADE"),
                  primary_key=True),
        sa.Column("sprint_id", sa.String(length=100), primary_key=True),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("goal", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=10), nullable=False),
        sa.Column("length_days", sa.Integer(), nullable=False),
        sa.Column("capacity_points", sa.Float(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("planned_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("effort_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("effort_sync_error", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "stories",
        sa.Column("project_id", sa.String(length=32), sa.ForeignKey("projects.id", ondelete="CASCADE"),
                  primary_key=True),
        sa.Column("story_id", sa.String(length=200), primary_key=True),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("acceptance_criteria", sa.JSON(), nullable=False),
        sa.Column("issue_type", sa.String(length=20), nullable=True),
        sa.Column("priority", sa.String(length=20), nullable=True),
        sa.Column("story_points", sa.Float(), nullable=True),
        sa.Column("epic", sa.String(length=200), nullable=True),
        sa.Column("blocked_by", sa.Integer(), nullable=False),
        sa.Column("depends_on", sa.Integer(), nullable=False),
        sa.Column("needed_by", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=12), nullable=False),
        sa.Column("sprint_id", sa.String(length=100), nullable=True),
        sa.Column("source", sa.String(length=12), nullable=False),
        sa.Column("synthetic", sa.Boolean(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("reopened", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["project_id", "sprint_id"], ["sprints.project_id", "sprints.sprint_id"]),
    )
    op.create_table(
        "sprint_items",
        sa.Column("project_id", sa.String(length=32), primary_key=True),
        sa.Column("sprint_id", sa.String(length=100), primary_key=True),
        sa.Column("story_id", sa.String(length=200), primary_key=True),
        sa.Column("committed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("added_mid_sprint", sa.Boolean(), nullable=False),
        sa.Column("points_at_commit", sa.Float(), nullable=True),
        sa.Column("left_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("points_at_close", sa.Float(), nullable=True),
        sa.Column("done_in_sprint", sa.Boolean(), nullable=True),
        sa.ForeignKeyConstraint(["project_id", "sprint_id"], ["sprints.project_id", "sprints.sprint_id"],
                                ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["project_id", "story_id"], ["stories.project_id", "stories.story_id"],
                                ondelete="CASCADE"),
    )


def downgrade() -> None:
    op.drop_table("sprint_items")
    op.drop_table("stories")
    op.drop_table("sprints")
