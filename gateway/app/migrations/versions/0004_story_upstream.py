"""Stories keep what Components 1-3 found about them

Revision ID: 0004
Revises: 0003
Created: 2026-10-15
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("stories") as batch:
        batch.add_column(sa.Column("upstream", sa.JSON(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("stories") as batch:
        batch.drop_column("upstream")
