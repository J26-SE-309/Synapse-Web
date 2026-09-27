"""The platform's projects. A project is one team's backlog and sprints; every component keys its data by the
project's id, and the web app's project picker lists them from here."""

from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app import tables
from app.db import get_session

router = APIRouter(tags=["projects"])

# A short key like a Jira project key: capitals and digits, words joined by single hyphens (TUTOR, SYN-STEADY).
PROJECT_ID_PATTERN = r"^[A-Z][A-Z0-9]*(-[A-Z0-9]+)*$"


class ProjectCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    id: str = Field(min_length=2, max_length=32, pattern=PROJECT_ID_PATTERN,
                    description="Short key the components store data under, e.g. TUTOR; it cannot change later")
    name: str = Field(min_length=1, max_length=80)
    description: str = Field(default="", max_length=500)


class ProjectUpdate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=1, max_length=80)
    description: str | None = Field(default=None, max_length=500)


class Project(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    description: str
    data_source: Literal["platform", "tawos", "synthetic"] = Field(
        description="platform: created in Synapse; tawos or synthetic: development data, not for evaluation")
    created_at: datetime


DbSession = Annotated[Session, Depends(get_session)]


def _unavailable() -> HTTPException:
    return HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "The platform database is not reachable")


def _found(session: Session, project_id: str) -> tables.Project:
    project = session.get(tables.Project, project_id)
    if project is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No project '{project_id}'")
    return project


@router.get("/projects", response_model=list[Project])
def list_projects(session: DbSession) -> list[Project]:
    """Every project, by name."""
    try:
        rows = session.scalars(select(tables.Project).order_by(tables.Project.name, tables.Project.id))
        return [Project.model_validate(row) for row in rows]
    except SQLAlchemyError:
        raise _unavailable() from None


@router.post("/projects", response_model=Project, status_code=status.HTTP_201_CREATED)
def create_project(request: ProjectCreate, session: DbSession) -> Project:
    try:
        if session.get(tables.Project, request.id) is not None:
            raise HTTPException(status.HTTP_409_CONFLICT, f"A project with the id '{request.id}' already exists")
        project = tables.Project(**request.model_dump(), data_source="platform")
        session.add(project)
        session.commit()
        return Project.model_validate(project)
    except IntegrityError:  # created by someone else in the meantime
        raise HTTPException(status.HTTP_409_CONFLICT, f"A project with the id '{request.id}' already exists") from None
    except SQLAlchemyError:
        raise _unavailable() from None


@router.get("/projects/{project_id}", response_model=Project)
def get_project(project_id: str, session: DbSession) -> Project:
    try:
        return Project.model_validate(_found(session, project_id))
    except SQLAlchemyError:
        raise _unavailable() from None


@router.patch("/projects/{project_id}", response_model=Project)
def update_project(project_id: str, request: ProjectUpdate, session: DbSession) -> Project:
    """Rename a project or change its description. The id stays: the components' data is stored under it."""
    try:
        project = _found(session, project_id)
        for name, value in request.model_dump(exclude_unset=True, exclude_none=True).items():
            setattr(project, name, value)
        session.commit()
        return Project.model_validate(project)
    except SQLAlchemyError:
        raise _unavailable() from None
