"""Development projects and demonstration data.

The development projects are the ones the effort-estimation service holds sprint history for (real TAWOS
sprints replayed, and small made-up teams); `data_source` tells them apart from projects people create, so they
can be removed in one step once the platform has real projects.

Run from gateway/ (the database is the gateway's: DATABASE_URL in gateway/.env, else the local platform-db), or
inside the gateway container (docker compose exec gateway python -m app.devdata ...):
    python -m app.devdata load      # add them; projects that already exist are left as they are
    python -m app.devdata list
    python -m app.devdata delete    # remove them again (only the development ones)

    python -m app.devdata demo MY-PROJECT --replace   # a complete demonstration backlog and sprints (app/demo.py)
    python -m app.devdata signals [MY-PROJECT]        # Components 1-3's signals for stories without them
"""

import argparse
import asyncio
from urllib.parse import quote

import httpx2
from sqlalchemy import delete, select

from app import db, demo, keys, signals, tables
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
    """Add the development projects that are missing (and bring the others' descriptions up to date); the ids
    added."""
    with db.SessionLocal() as session:
        existing = {project.id: project for project in session.scalars(select(tables.Project))}
        taken = {project.key for project in existing.values()}
        added = []
        for project_id, name, source, description in DEV_PROJECTS:
            if project_id in existing:
                existing[project_id].description = description
                continue
            key = keys.suggest(name, taken)
            taken.add(key)
            session.add(tables.Project(id=project_id, name=name, key=key, data_source=source, description=description))
            added.append(project_id)
        session.commit()
    return added


def remove() -> int:
    with db.engine.begin() as connection:
        return connection.execute(delete(tables.Project).where(tables.Project.data_source.in_(DEV_SOURCES))).rowcount


def _effort_url(project_id: str, sprint_id: str | None = None) -> str:
    base = get_settings().component_urls()["effort-estimation"]
    url = f"{base}/api/v1/projects/{quote(project_id, safe='')}"
    return f"{url}/sprints/{quote(sprint_id, safe='')}" if sprint_id else f"{url}/history"


async def _sync(project_id: str, sprint_ids: list[str]) -> list[str]:
    """Send the project's sprints to the effort service and remove the ones it holds that are gone; problems."""
    problems = []
    async with httpx2.AsyncClient(timeout=60) as client:
        try:
            known = [s["sprint_id"] for s in (await client.get(_effort_url(project_id))).json().get("sprints", [])]
        except (httpx2.HTTPError, ValueError):
            known = []
        for sprint_id in demo.stale_effort_sprints(known, sprint_ids):
            try:
                await client.delete(_effort_url(project_id, sprint_id))
            except httpx2.HTTPError:
                problems.append(f"{sprint_id}: could not be removed from the effort service")
        for sprint_id in sprint_ids:
            error = await push_sprint(client, project_id, sprint_id)
            if error:
                problems.append(f"{sprint_id}: {error}")
    return problems


def _demo(project_id: str, replace: bool) -> None:
    with db.SessionLocal() as session:
        if session.get(tables.Project, project_id) is None:
            raise SystemExit(f"there is no project {project_id}")
        if demo.existing_story_count(session, project_id) and not replace:
            raise SystemExit(f"{project_id} already has stories; add --replace to replace its backlog and sprints")
        sprint_ids = demo.build(session, project_id)
        stories = demo.existing_story_count(session, project_id)
    print(f"{project_id}: {stories} stories in {len(sprint_ids)} sprints ({', '.join(sprint_ids)}) and the backlog")
    problems = asyncio.run(_sync(project_id, sprint_ids))
    print("The effort service has the sprints." if not problems else
          "Not all reached the effort service:\n  " + "\n  ".join(problems))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("command", choices=["load", "list", "delete", "demo", "signals"])
    parser.add_argument("project", nargs="?", help="the project, for demo (required) and signals (all if left out)")
    parser.add_argument("--replace", action="store_true", help="demo: replace the project's backlog and sprints")
    args = parser.parse_args()
    if not db.migrate():
        raise SystemExit("the platform database cannot be reached or migrated")
    if args.command == "demo":
        if not args.project:
            parser.error("demo needs the project's id")
        _demo(args.project, args.replace)
    elif args.command == "signals":
        with db.SessionLocal() as session:
            print(f"Signals for {signals.fill(session, args.project)} story(ies)")
    elif args.command == "load":
        added = load()
        print(f"Added {len(added)} development project(s): {', '.join(added) or 'none (all present)'}")
    elif args.command == "delete":
        print(f"Removed {remove()} development project(s)")
    else:
        with db.SessionLocal() as session:
            for project in session.scalars(select(tables.Project).order_by(tables.Project.id)):
                print(f"{project.id:16} {project.key:6} {project.data_source:10} {project.name}")


if __name__ == "__main__":
    main()
