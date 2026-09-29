"""Stories keep their place in the backlog

Revision ID: 0003
Revises: 0002
Created: 2026-09-29
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("stories") as batch:
        batch.add_column(sa.Column("rank", sa.Float(), nullable=False, server_default="0"))
    # Existing stories keep the order they were created in.
    connection = op.get_bind()
    rows = connection.execute(
        sa.text("SELECT project_id, story_id FROM stories ORDER BY project_id, created_at, story_id"))
    ranks: dict[str, int] = {}
    for project_id, story_id in rows.fetchall():
        ranks[project_id] = ranks.get(project_id, 0) + 1
        connection.execute(sa.text("UPDATE stories SET rank = :rank WHERE project_id = :project AND story_id = :story"),
                           {"rank": ranks[project_id], "project": project_id, "story": story_id})


def downgrade() -> None:
    with op.batch_alter_table("stories") as batch:
        batch.drop_column("rank")
