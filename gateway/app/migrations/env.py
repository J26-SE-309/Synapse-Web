"""Alembic environment: migrations run on the gateway's engine (app.db). db.migrate() passes in the connection
that holds the migration lock; the alembic command line (run from gateway/) opens its own."""

from alembic import context

from app import db, tables  # noqa: F401  (tables registers the models on Base.metadata)

target_metadata = db.Base.metadata


def _run(connection) -> None:
    # SQLite cannot alter most things in place: batch mode rebuilds the table instead (the tests use SQLite).
    context.configure(connection=connection, target_metadata=target_metadata,
                      render_as_batch=connection.dialect.name == "sqlite")
    with context.begin_transaction():
        context.run_migrations()


if (connection := context.config.attributes.get("connection")) is not None:
    _run(connection)
else:
    with db.engine.connect() as connection:
        _run(connection)
        connection.commit()
