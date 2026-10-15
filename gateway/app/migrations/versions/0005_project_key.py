"""Projects get a short key for their story and sprint ids

Revision ID: 0005
Revises: 0004
Created: 2026-10-15
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from app.keys import suggest

revision: str = "0005"
down_revision: str | None = "0004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("projects") as batch:
        batch.add_column(sa.Column("key", sa.String(5), nullable=True))
    connection = op.get_bind()
    taken: set[str] = set()
    for project_id, name in connection.execute(sa.text("SELECT id, name FROM projects ORDER BY created_at, id")):
        key = suggest(name, taken)
        taken.add(key)
        connection.execute(sa.text("UPDATE projects SET key = :key WHERE id = :id"), {"key": key, "id": project_id})
    with op.batch_alter_table("projects") as batch:
        batch.alter_column("key", existing_type=sa.String(5), nullable=False)
        batch.create_unique_constraint("uq_projects_key", ["key"])


def downgrade() -> None:
    with op.batch_alter_table("projects") as batch:
        batch.drop_constraint("uq_projects_key", type_="unique")
        batch.drop_column("key")
