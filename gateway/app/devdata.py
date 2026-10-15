"""Development projects: the ones the effort-estimation service holds development sprint history for (real
TAWOS sprints replayed, and small synthetic teams). They are labelled by `data_source` (the web app shows it
next to the name, e.g. "Synthetic") and can be removed in one step once the platform has real projects.

Run from gateway/ (the database is the gateway's: DATABASE_URL in gateway/.env, else the local platform-db):
    python -m app.devdata load      # add them; projects that already exist are left as they are
    python -m app.devdata list
    python -m app.devdata delete    # remove them again (only the development ones)

Synthetic data for one project's demos (app/synthetic.py), e.g. a project people created to try the platform:
    python -m app.devdata synthetic-signals MY-PROJECT   # Components 1-3's signals for its stories
    python -m app.devdata synthetic-history MY-PROJECT   # 4 closed sprints before its first, sent to effort
    python -m app.devdata remove-synthetic MY-PROJECT    # take both out again (also from the effort service)
"""

import argparse
import asyncio
from urllib.parse import quote

import httpx2
from sqlalchemy import delete, select

from app import db, synthetic, tables
from app.config import get_settings
from app.sprint_sync import push_sprint

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


async def _send(project_id: str, sprint_ids: list[str], remove: bool = False) -> list[str]:
    """Send the sprints to the effort service (or delete them there); the problems, if any."""
    problems = []
    async with httpx2.AsyncClient(timeout=60) as client:
        for sprint_id in sprint_ids:
            if remove:
                base = get_settings().component_urls()["effort-estimation"]
                url = f"{base}/api/v1/projects/{quote(project_id, safe='')}/sprints/{quote(sprint_id, safe='')}"
                try:
                    response = await client.delete(url)
                    error = None if response.is_success else f"the effort service answered {response.status_code}"
                except httpx2.HTTPError:
                    error = "the effort service could not be reached"
            else:
                error = await push_sprint(client, project_id, sprint_id)
            if error:
                problems.append(f"{sprint_id}: {error}")
    return problems


def _synthetic(command: str, project_id: str) -> None:
    with db.SessionLocal() as session:
        if session.get(tables.Project, project_id) is None:
            raise SystemExit(f"there is no project {project_id}")
        if command == "synthetic-signals":
            print(f"Synthetic signals for {synthetic.add_signals(session, project_id)} story(ies) of {project_id}")
            return
        if command == "synthetic-history":
            sprint_ids = synthetic.add_history(session, project_id)
            print(f"Added {len(sprint_ids)} synthetic sprint(s): {', '.join(sprint_ids) or 'none (already there)'}")
            sprint_ids = sprint_ids or [s for s in session.scalars(select(tables.Sprint.sprint_id).filter_by(
                project_id=project_id)) if synthetic.SPRINT_MARK in s]
            synthetic.add_signals(session, project_id)  # the new stories get signals like the others
        else:
            sprint_ids, stories, cleared = synthetic.remove(session, project_id)
            print(f"Removed {len(sprint_ids)} synthetic sprint(s) and {stories} story(ies); cleared the signals of "
                  f"{cleared} story(ies)")
    problems = asyncio.run(_send(project_id, sprint_ids, remove=command == "remove-synthetic"))
    print("The effort service has them." if command == "synthetic-history" and not problems else
          "Removed from the effort service." if not problems else
          "Not all reached the effort service:\n  " + "\n  ".join(problems))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", choices=["load", "list", "delete", "synthetic-signals", "synthetic-history",
                                            "remove-synthetic"])
    parser.add_argument("project", nargs="?", help="the project, for the synthetic-* commands")
    args = parser.parse_args()
    if not db.migrate():
        raise SystemExit("the platform database cannot be reached or migrated")
    if args.command in ("synthetic-signals", "synthetic-history", "remove-synthetic"):
        if not args.project:
            parser.error(f"{args.command} needs the project's id")
        _synthetic(args.command, args.project)
    elif args.command == "load":
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
