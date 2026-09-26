"""The gateway's own tables, in the platform database. Change them with a migration (app/migrations)."""

from datetime import UTC, datetime

from sqlalchemy import DateTime, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Project(Base):
    """A project of the platform: one team's backlog and sprints. Every component keys its data by the id."""

    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    description: Mapped[str] = mapped_column(Text, default="")
    # "platform" for projects people create; "tawos" and "synthetic" mark development data (removable).
    data_source: Mapped[str] = mapped_column(String(20), default="platform")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(UTC))
