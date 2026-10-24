"""Access to the gateway's own PostgreSQL database: hosted (Neon) or local (the platform-db container).

A hosted database may be asleep (Neon suspends after 5 idle minutes and closes the pool's connections): the first
connection waits for it to wake, and pool_pre_ping replaces connections it closed.
"""

import logging
import time
from collections.abc import Iterator
from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.util import CommandError
from sqlalchemy import create_engine, event, make_url, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings

log = logging.getLogger(__name__)

MIGRATIONS = Path(__file__).resolve().parent / "migrations"
MIGRATION_LOCK = 5_440_001  # PostgreSQL advisory lock: one gateway process migrates at a time
LOCAL_HOSTS = {"localhost", "127.0.0.1", "::1", "platform-db"}
DOWN_SECONDS = 30.0  # how long /health reports a hosted database unavailable after a failed connection


class Base(DeclarativeBase):
    """Base class for the gateway's tables."""


def is_hosted(url: str) -> bool:
    """True for a database elsewhere (Neon), False for SQLite or the gateway's own container."""
    parsed = make_url(url)
    return not parsed.drivername.startswith("sqlite") and parsed.host not in LOCAL_HOSTS


hosted = is_hosted(get_settings().database)
engine = create_engine(get_settings().database, pool_pre_ping=True,
                       connect_args={"connect_timeout": 5 if hosted else 2})
SessionLocal = sessionmaker(bind=engine, autoflush=False)
_down_until = 0.0


@event.listens_for(engine, "handle_error")
def _connection_failed(context) -> None:
    """Remember a lost or refused connection, for /health (which does not query a hosted database). A connection
    the pre-ping finds closed is not one: Neon closes idle connections when it suspends, and the pool reconnects."""
    global _down_until
    if (context.is_disconnect or context.connection is None) and not context.is_pre_ping:
        _down_until = time.monotonic() + DOWN_SECONDS


def recently_down() -> bool:
    """True for DOWN_SECONDS after a connection to the database failed."""
    return time.monotonic() < _down_until


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
