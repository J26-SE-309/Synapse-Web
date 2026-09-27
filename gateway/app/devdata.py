"""Development projects: the ones the effort-estimation service holds development sprint history for (real
TAWOS sprints replayed, and small synthetic teams). They are labelled by `data_source` (the web app shows it
next to the name, e.g. "Synthetic") and can be removed in one step once the platform has real projects.

Run from gateway/ (the database is the gateway's: DATABASE_URL in gateway/.env, else the local platform-db):
    python -m app.devdata load      # add them; projects that already exist are left as they are
    python -m app.devdata list
    python -m app.devdata delete    # remove them again (only the development ones)
"""

import argparse

from sqlalchemy import delete, select

from app import db, tables

DEV_PROJECTS: tuple[tuple[str, str, str, str], ...] = (
    ("TAWOS-MESOS", "Apache Mesos", "tawos",
     "Real sprints of the Apache Mesos project from the TAWOS dataset, replayed as sprint history."),
    ("TAWOS-INDY", "Hyperledger Indy", "tawos",
     "Real sprints of the Hyperledger Indy project from the TAWOS dataset, replayed as sprint history."),
    ("SYN-NEW", "New team", "synthetic", "A brand-new team in its first sprint, still running."),
    ("SYN-ONE", "One sprint closed", "synthetic", "A team that has closed one sprint."),
    ("SYN-TWO", "Two sprints closed", "synthetic",
     "A team that has closed two sprints: one short of leaving the cold start."),
    ("SYN-STEADY", "Steady team", "synthetic", "A predictable team with eight closed sprints."),
    ("SYN-ERRATIC", "Erratic team", "synthetic", "An unpredictable team with eight closed sprints."),
    ("SYN-NOPOINTS", "No story points", "synthetic",
     "A team that does not estimate in story points, with four closed sprints."),
)
DEV_SOURCES = ("tawos", "synthetic")


def load() -> list[str]:
    """Add the development projects that are missing; the ids added."""
    with db.SessionLocal() as session:
        existing = set(session.scalars(select(tables.Project.id)))
        added = [project_id for project_id, *_ in DEV_PROJECTS if project_id not in existing]
        session.add_all(tables.Project(id=project_id, name=name, data_source=source,
                                       description=f"{description} Development data, not for evaluation.")
                        for project_id, name, source, description in DEV_PROJECTS if project_id in added)
        session.commit()
    return added


def remove() -> int:
    with db.engine.begin() as connection:
        return connection.execute(delete(tables.Project).where(tables.Project.data_source.in_(DEV_SOURCES))).rowcount


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", choices=["load", "list", "delete"])
    args = parser.parse_args()
    if not db.migrate():
        raise SystemExit("the platform database cannot be reached or migrated")
    if args.command == "load":
        added = load()
        print(f"Added {len(added)} development project(s): {', '.join(added) or 'none (all present)'}")
    elif args.command == "delete":
        print(f"Removed {remove()} development project(s)")
    else:
        with db.SessionLocal() as session:
            for project in session.scalars(select(tables.Project).order_by(tables.Project.id)):
                print(f"{project.id:14} {project.data_source:10} {project.name}")


if __name__ == "__main__":
    main()
