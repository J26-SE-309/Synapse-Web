"""Access to the gateway's own PostgreSQL database."""

import logging
from collections.abc import Iterator
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.util import CommandError
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings

log = logging.getLogger(__name__)

MIGRATIONS = Path(__file__).resolve().parent / "migrations"
MIGRATION_LOCK = 5_440_001  # PostgreSQL advisory lock: one gateway process migrates at a time


class Base(DeclarativeBase):
    """Base class for the gateway's tables."""


engine = create_engine(get_settings().database_url, pool_pre_ping=True, connect_args={"connect_timeout": 2})
SessionLocal = sessionmaker(bind=engine, autoflush=False)


def get_session() -> Iterator[Session]:
    """FastAPI dependency: one database session per request."""
    with SessionLocal() as session:
        yield session


def database_ok() -> bool:
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


def migrate(target=None, revision: str = "head") -> bool:
    """Bring the database (default: the gateway's) to the latest migration in app/migrations. False if it could
    not be reached or migrated; the gateway still starts, and the endpoints that need tables answer 503."""
    target = target if target is not None else engine
    try:
        with target.connect() as connection:
            postgres = connection.dialect.name == "postgresql"
            if postgres:
                connection.execute(text("SELECT pg_advisory_lock(:key)"), {"key": MIGRATION_LOCK})
            try:
                config = Config()
                config.set_main_option("script_location", str(MIGRATIONS))
                config.attributes["connection"] = connection
                command.upgrade(config, revision)
                connection.commit()
            finally:
                connection.rollback()
                if postgres:  # the lock belongs to the connection, which goes back to the pool
                    connection.execute(text("SELECT pg_advisory_unlock(:key)"), {"key": MIGRATION_LOCK})
                    connection.commit()
        return True
    except (SQLAlchemyError, CommandError) as error:
        log.error("the platform database was not migrated: %s", error)
        return False
