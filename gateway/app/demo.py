"""A complete demonstration project: a small team building a task-management app, with four finished sprints, a
fifth starting today, and a backlog of what comes next.

    python -m app.devdata demo MY-PROJECT --replace

Every story is complete (a description, Given / When / Then acceptance criteria, an epic, a priority, points and
its links), so the components' signals are complete too and the estimates show the team's real planning problems:
a sprint committed above the team's pace, dependencies, a story carried over. The project's own stories and
sprints are replaced; its id and name stay. Stories are marked synthetic in the database (not shown anywhere), so
the demonstration data can be told apart from a real team's later.
"""

from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app import signals, tables

LENGTH_DAYS = 14
CAPACITY = 30


@dataclass
class Item:
    sprint: int | None  # 1-5, or None for the backlog
    title: str
    issue_type: str
    points: float
    priority: str
    epic: str
    description: str
    criteria: list[str]
    blocked_by: int = 0
    depends_on: int = 0
    needed_by: int = 0
    spills: bool = False  # not finished in its sprint: carried into the next one
    final_points: float | None = None  # re-estimated during the sprint
    reopened: bool = False
    status: str = "done"  # in the running sprint and the backlog: to_do or in_progress
    extra: dict = field(default_factory=dict)


STORIES = [
    # ---- Sprint 1: the foundations
    Item(1, "Set up the repository, coding standards and pull-request checks", "Task", 2, "Major", "Platform",
         "Create the Git repository with the agreed branch rules, add linting and formatting, and run the checks on "
         "every pull request so the whole team works to the same conventions from the first day.",
         ["Given a new pull request, when it is opened, then lint, format and unit-test checks run and must pass "
          "before it can be merged",
          "Given the repository, when a developer clones it, then the README explains how to install and run the "
          "app locally"], needed_by=2),
    Item(1, "Design the database schema for users, teams and tasks", "Task", 5, "Critical", "Platform",
         "Model users, teams, team memberships and tasks with their relations, write the first migration, and add a "
         "seed script with a small data set for local development and demonstrations.",
         ["Given an empty database, when the migrations run, then the users, teams, memberships and tasks tables "
          "exist with their keys and constraints",
          "Given the seed script, when it runs, then two teams with members and tasks are created"], needed_by=3),
    Item(1, "As a new user I want to sign up with my email so that I can create an account", "Story", 5, "Critical",
         "Accounts",
         "A visitor enters their name, email address and a password; the account is created after the email address "
         "is confirmed through a link that is valid for 24 hours.",
         ["Given I am on the sign-up page, when I submit a valid name, email and password, then I receive a "
          "confirmation email",
          "Given I received the confirmation email, when I open the link within 24 hours, then my account is active",
          "Given the email address is already registered, when I sign up with it, then I am told to sign in instead"],
         depends_on=1),
    Item(1, "As a registered user I want to log in and log out so that my account stays private", "Story", 3,
         "Critical", "Accounts",
         "Users sign in with their email address and password and sign out from the menu; after five failed attempts "
         "the account is locked for fifteen minutes to slow down guessing.",
         ["Given I have an active account, when I enter the right email and password, then I see my home page",
          "Given I am signed in, when I choose Sign out, then my session ends and I return to the sign-in page",
          "Given I entered a wrong password five times, when I try again, then I am told to wait fifteen minutes"],
         depends_on=1),
    Item(1, "Landing page that explains the product's main features", "New Feature", 2, "Minor", "Onboarding",
         "A public page describing what the app does for small teams, with screenshots of the task list and a clear "
         "button to sign up, so that visitors understand the product before creating an account.",
         ["Given I am not signed in, when I open the site, then I see the landing page with the main features",
          "Given I am on the landing page, when I choose Sign up, then the sign-up page opens"], needed_by=1),
    Item(1, "As a user I want to reset my forgotten password so that I can get back into my account", "Story", 3,
         "Major", "Accounts",
         "From the sign-in page a user asks for a reset link by email; the link is valid for one hour and lets them "
         "choose a new password, after which all their other sessions are signed out.",
         ["Given I forgot my password, when I ask for a reset link, then I receive it by email",
          "Given I open a reset link within one hour, when I choose a new password, then I can sign in with it",
          "Given a reset link older than one hour, when I open it, then I am told to ask for a new one"],
         depends_on=1, spills=True),
    # ---- Sprint 2: tasks
    Item(2, "As a team member I want to create a task with a title, description and due date", "Story", 3, "Major",
         "Tasks",
         "Team members add tasks to their team's list with a title, an optional description and an optional due "
         "date, so that the work the team agreed on is written down in one place.",
         ["Given I am in my team, when I save a task with a title, then it appears in the team's task list",
          "Given I leave the title empty, when I save, then I am asked for a title and nothing is saved"],
         needed_by=3),
    Item(2, "As a team member I want to see my tasks in a list so that I know what to work on", "Story", 3, "Major",
         "Tasks",
         "The home page lists the signed-in member's open tasks with their title, status and due date, the ones due "
         "soonest first, so each person sees their own work as soon as they sign in.",
         ["Given I have three open tasks, when I open the home page, then I see the three tasks sorted by due date",
          "Given I have no open tasks, when I open the home page, then I am told that nothing is assigned to me"],
         depends_on=1),
    Item(2, "As a team member I want to mark a task as done so that the team sees my progress", "Story", 2, "Major",
         "Tasks",
         "Each task gets a Done action that changes its status and records who finished it and when, so the team "
         "list and the team lead's view always show what is finished.",
         ["Given an open task assigned to me, when I mark it as done, then its status is Done with my name and the "
          "time",
          "Given a done task, when I open it, then I can reopen it if it was closed by mistake"]),
    Item(2, "As a team lead I want to assign a task to a team member so that work is shared out", "Story", 5,
         "Critical", "Tasks",
         "The team lead chooses a member from the team for any task; the member sees it in their list straight away "
         "and the task shows who it is assigned to.",
         ["Given I lead the team, when I assign a task to a member, then it appears in that member's list",
          "Given a task assigned to someone else, when I reassign it, then it moves to the new member's list"],
         needed_by=2),
    Item(2, "As a team member I want to set a task's priority so that urgent work comes first", "Story", 3, "Major",
         "Tasks",
         "Tasks get a priority of high, normal or low, shown as a coloured label with its name, and the lists can be "
         "sorted by priority so the most urgent work is at the top.",
         ["Given a task, when I set its priority to High, then the task shows a High label",
          "Given tasks with different priorities, when I sort by priority, then high-priority tasks come first"]),
    Item(2, "Task list does not refresh after a task is edited", "Bug", 1, "Major", "Tasks",
         "Steps: open the task list, edit a task's title and save. Expected: the list shows the new title. Actual: "
         "the old title stays until the page is reloaded by hand.",
         ["Given I edited a task's title, when I save it, then the list shows the new title without reloading"]),
    Item(2, "As a team member I want to comment on a task so that we discuss it in one place", "Story", 5, "Major",
         "Tasks",
         "Members write comments on a task, newest last, with the author's name and time; the person assigned to the "
         "task is told about new comments so discussions do not get lost in chat.",
         ["Given a task, when I add a comment, then it appears under the task with my name and the time",
          "Given someone comments on my task, when the comment is saved, then I see a notification"],
         final_points=8),
    Item(2, "As a team member I want to filter tasks by status so that I find open work quickly", "Story", 3,
         "Minor", "Tasks",
         "The task list gets a status filter (to do, in progress, done) that is kept in the page address, so a "
         "filtered list can be bookmarked or shared with the team.",
         ["Given tasks in every status, when I filter by In progress, then only tasks in progress are listed",
          "Given a filtered list, when I copy its address and open it again, then the same filter is applied"],
         spills=True),
    # ---- Sprint 3: the team's workspace
    Item(3, "As an admin I want to invite people to my team by email so that they can join it", "Story", 5, "Major",
         "Team workspace",
         "An admin enters email addresses to invite; each person gets a link that adds them to the team after they "
         "sign up or sign in, and invitations expire after seven days.",
         ["Given I am an admin, when I invite an email address, then the person receives an invitation link",
          "Given an invitation link, when the person signs in through it, then they become a member of the team",
          "Given an invitation older than seven days, when it is opened, then it is refused"], depends_on=1),
    Item(3, "As a user I want a profile page with my name and photo so that teammates recognise me", "Story", 3,
         "Minor", "Team workspace",
         "Users edit their display name and upload a square photo of up to 2 MB, shown next to their tasks and "
         "comments so teammates can tell who is who.",
         ["Given my profile page, when I change my display name, then the new name shows on my tasks",
          "Given a photo larger than 2 MB, when I upload it, then I am told the limit and nothing changes"]),
    Item(3, "As a team member I want to attach a file to a task so that the details are with it", "Story", 5,
         "Major", "Tasks",
         "Files of up to 20 MB can be attached to a task and downloaded by every member of the team; the task shows "
         "each file's name, size and who added it.",
         ["Given a task, when I attach a PDF of 5 MB, then teammates can download it from the task",
          "Given a file larger than 20 MB, when I attach it, then I am told the limit and it is not uploaded"]),
    Item(3, "Due dates show the wrong day for users outside Sri Lanka", "Bug", 2, "Critical", "Tasks",
         "Steps: set your time zone to London and give a task a due date of 20 October. Expected: the task is due on "
         "20 October. Actual: it shows 19 October, because dates are stored as local midnight.",
         ["Given a user in London, when they set a due date of 20 October, then every member sees 20 October",
          "Given existing tasks, when the fix is released, then their due dates are unchanged for Sri Lankan users"]),
    Item(3, "As a team member I want to search tasks by title so that I find one without scrolling", "Story", 3,
         "Minor", "Tasks",
         "A search box above the task list finds tasks whose title contains the words typed, ignoring case, and "
         "highlights the matching words in the results.",
         ["Given tasks titled 'Invoice export' and 'Login page', when I search for 'invoice', then only the first "
          "is listed",
          "Given a search with no matches, when I submit it, then I am told nothing matched"]),
    Item(3, "Accessibility review of the task forms", "Task", 3, "Major", "Platform",
         "Check the sign-in, task and comment forms against WCAG 2.1 AA: labels, keyboard use, focus order, error "
         "messages and colour contrast, and fix what fails.",
         ["Given each task form, when it is used with the keyboard only, then every field and button can be reached "
          "in order",
          "Given the forms, when they are checked with an automated accessibility tool, then no AA violations are "
          "reported"], reopened=True),
    Item(3, "Add pagination to the tasks API", "Improvement", 2, "Minor", "Platform",
         "The tasks endpoint returns at most 50 tasks per page with a link to the next page, so large teams' lists "
         "load quickly and the server is not asked for thousands of rows at once.",
         ["Given a team with 120 tasks, when the first page is requested, then 50 tasks and a next-page link come "
          "back",
          "Given the last page, when it is requested, then there is no next-page link"], needed_by=1, spills=True),
    # ---- Sprint 4: quality and speed
    Item(4, "Set up automated tests and the CI pipeline", "Task", 3, "Major", "Platform",
         "Add unit tests for the task service and end-to-end tests for sign-in and task creation, run them in the CI "
         "pipeline on every push, and block merges when a test fails.",
         ["Given a push to any branch, when the pipeline runs, then unit and end-to-end tests run",
          "Given a failing test, when a pull request is opened, then it cannot be merged"]),
    Item(4, "As a team lead I want to archive finished tasks so that the board stays readable", "Story", 3, "Minor",
         "Tasks",
         "Done tasks older than 30 days move to an archive automatically, and a team lead can archive or restore any "
         "done task by hand; archived tasks still appear in search.",
         ["Given a task done more than 30 days ago, when the nightly job runs, then it moves to the archive",
          "Given an archived task, when I restore it, then it is back in the task list"]),
    Item(4, "Speed up the task list for teams with many tasks", "Improvement", 3, "Major", "Platform",
         "The task list takes four seconds for a team with 2,000 tasks; add the missing database indexes and load "
         "only the fields the list shows, aiming for under one second.",
         ["Given a team with 2,000 tasks, when the task list opens, then it loads in under one second",
          "Given the change, when the existing tests run, then they all pass"], depends_on=1),
    Item(4, "Set up error monitoring for the web app", "Task", 2, "Major", "Platform",
         "Report unhandled errors from the browser and the server to the monitoring service with the release "
         "version, and alert the team in its chat channel when a new error appears.",
         ["Given an unhandled error in the browser, when it happens, then it appears in the monitoring service "
          "with the release version",
          "Given a new kind of error, when it is first reported, then the team's channel gets an alert"]),
    Item(4, "As a team member I want to edit a task's description so that it stays up to date", "Story", 2,
         "Minor", "Tasks",
         "Members edit a task's description in place, with a simple formatting toolbar; the task keeps the time and "
         "author of the last change.",
         ["Given a task, when I edit its description and save, then the new text is shown with my name and the time",
          "Given I cancel an edit, when I leave the field, then the previous description is unchanged"]),
    Item(4, "Typo on the sign-in page", "Bug", 1, "Trivial", "Accounts",
         "The sign-in button reads 'Sing in'. Expected: 'Sign in'. The same text is used in the confirmation email, "
         "which should be corrected too.",
         ["Given the sign-in page, when it loads, then the button reads 'Sign in'",
          "Given a confirmation email, when it is sent, then it says 'Sign in'"]),
    Item(4, "Export the task list to CSV", "New Feature", 2, "Minor", "Reporting",
         "A team lead downloads the team's tasks as a CSV file with title, status, assignee, priority and due date, "
         "for reports and for planning in a spreadsheet.",
         ["Given a team with tasks, when I export them, then the CSV has one row per task with the five columns",
          "Given a filtered list, when I export it, then only the listed tasks are in the file"]),
    Item(4, "As a team member I want to duplicate a task so that similar work is quick to add", "Story", 2, "Minor",
         "Tasks",
         "A Duplicate action copies a task's title, description, priority and attachments into a new task in the "
         "same team, unassigned and without comments.",
         ["Given a task, when I duplicate it, then a new task with the same title, description and priority appears",
          "Given the copy, when I open it, then it has no comments and nobody is assigned"]),
    Item(4, "As a team lead I want to change the due dates of several tasks at once so that replanning is quick",
         "Story", 5, "Major", "Tasks",
         "The team lead selects tasks in the list and moves their due dates by a number of days or sets one date for "
         "all, with a summary of what will change before it is applied.",
         ["Given five selected tasks, when I move their due dates by three days, then each due date is three days "
          "later",
          "Given the summary, when I cancel, then no due date changes"], depends_on=1, spills=True,
         status="in_progress"),
    # ---- Sprint 5: the team lead's view (running)
    Item(5, "As a team lead I want a dashboard of my team's open tasks so that I can see what is in progress",
         "Story", 8, "Major", "Reporting",
         "A dashboard shows the team's open tasks grouped by member and status, with overdue tasks highlighted, so "
         "the team lead can spot who is overloaded and what is late at a glance.",
         ["Given my team has open tasks, when I open the dashboard, then I see them grouped by member and status",
          "Given a task past its due date, when the dashboard loads, then the task is highlighted as overdue",
          "Given a member with no open tasks, when the dashboard loads, then they are shown as free"],
         blocked_by=1, depends_on=1, status="to_do"),
    Item(5, "Reporting endpoint for the team's open tasks", "Task", 3, "Major", "Reporting",
         "Add an API endpoint that returns a team's open tasks with assignee, status and due date in one request, "
         "for the dashboard; only members of the team may call it.",
         ["Given a team lead's token, when the endpoint is called, then the team's open tasks come back in one "
          "response",
          "Given a token of someone outside the team, when the endpoint is called, then the request is refused"],
         needed_by=1, status="in_progress"),
    Item(5, "Email notification when a task is assigned to me", "New Feature", 5, "Major", "Notifications",
         "When someone assigns a task to a user, send them an email with the task's title and a link to it; users "
         "can turn these emails off in their settings.",
         ["Given a task is assigned to me, when the assignment is saved, then I receive an email with a link to it",
          "Given I turned assignment emails off, when a task is assigned to me, then no email is sent"],
         depends_on=1, status="to_do"),
    Item(5, "Notifications are sent twice when a task is reassigned", "Bug", 2, "Critical", "Notifications",
         "Steps: assign a task to Nimal, then reassign it to Kasun. Expected: Kasun is notified once. Actual: Kasun "
         "gets two notifications and Nimal one more.",
         ["Given a task assigned to Nimal, when it is reassigned to Kasun, then Kasun gets exactly one notification",
          "Given the reassignment, when it is saved, then Nimal gets no new notification"], status="to_do"),
    Item(5, "As a team lead I want a weekly summary email so that I know how the week went", "Story", 3, "Minor",
         "Notifications",
         "Every Friday at 17:00 the team lead receives an email listing the tasks finished that week, the ones that "
         "are overdue and the ones due next week.",
         ["Given it is Friday at 17:00, when the summary job runs, then each team lead receives the week's summary",
          "Given a week with no finished tasks, when the summary is sent, then it says so instead of an empty list"],
         depends_on=1, status="to_do"),
    Item(5, "Task list is slow when a team has many completed tasks", "Improvement", 3, "Major", "Platform",
         "Teams with more than 5,000 done tasks wait several seconds for their list; done tasks should load only "
         "when asked for, and the open tasks first.",
         ["Given a team with 5,000 done tasks, when the task list opens, then the open tasks show within one second",
          "Given I choose to show done tasks, when I ask for them, then they load page by page"],
         status="to_do"),
    # ---- The backlog: the next sprints
    Item(None, "As a user I want two-step sign-in so that my account is safer", "Story", 5, "Major", "Accounts",
         "Users can turn on two-step sign-in with an authenticator app; after their password they enter a six-digit "
         "code, and they get ten recovery codes when they set it up.",
         ["Given two-step sign-in is on, when I enter my password, then I am asked for the six-digit code",
          "Given I lost my phone, when I enter a recovery code, then I can sign in and the code is used up"],
         depends_on=1, status="to_do"),
    Item(None, "As a team member I want a calendar view of due dates so that I can plan my week", "Story", 5,
         "Minor", "Tasks",
         "A month and a week view shows the team's tasks on their due dates, coloured by priority with the priority's "
         "name, and a task can be moved to another day by dragging it.",
         ["Given tasks with due dates this month, when I open the calendar, then each task is on its due date",
          "Given a task on the calendar, when I drag it to another day, then its due date changes to that day"],
         status="to_do"),
    Item(None, "As a team member I want recurring tasks so that routine work is created for me", "Story", 8,
         "Minor", "Tasks",
         "A task can repeat daily, weekly or monthly; the next one is created when the current one is done, with the "
         "same title, description, assignee and priority.",
         ["Given a weekly task, when I mark it as done, then the next one is created for a week later",
          "Given a recurring task, when I stop the repetition, then no further tasks are created"],
         status="to_do"),
    Item(None, "Mobile layout for the task list and the dashboard", "Improvement", 5, "Major", "Platform",
         "On screens narrower than 600 pixels the task list becomes a single column of cards and the dashboard's "
         "groups stack, so the app is usable on a phone without zooming.",
         ["Given a phone 375 pixels wide, when I open the task list, then it fits the screen without sideways "
          "scrolling",
          "Given the dashboard on a phone, when it loads, then each member's group is shown one under the other"],
         depends_on=1, status="to_do"),
    Item(None, "As a team lead I want an audit log of task changes so that I can see who changed what", "Story", 5,
         "Minor", "Reporting",
         "Every change to a task's title, status, assignee, priority or due date is recorded with who made it and "
         "when, and the team lead can read the log for any task.",
         ["Given a task's due date is changed, when I open its log, then I see the old and new date, who and when",
          "Given a team member who is not a lead, when they open the log, then they are told only leads can see it"],
         status="to_do"),
    Item(None, "Dark theme for the whole app", "New Feature", 3, "Trivial", "Platform",
         "Users choose a light, dark or system theme in their settings; every page keeps a contrast ratio of at "
         "least 4.5 to 1 in both themes.",
         ["Given I choose the dark theme, when I open any page, then it is shown in dark colours",
          "Given the dark theme, when the pages are checked for contrast, then text meets the 4.5 to 1 ratio"],
         status="to_do"),
]


def build(session: Session, project_id: str, now: datetime | None = None) -> list[str]:
    """Replace the project's stories and sprints with the demonstration ones; the sprint ids, oldest first."""
    project = session.get(tables.Project, project_id)
    if project is None:
        raise ValueError(f"there is no project {project_id}")
    key = project.key
    now = (now or datetime.now(UTC)).replace(microsecond=0)
    session.execute(delete(tables.SprintItem).where(tables.SprintItem.project_id == project_id))
    session.execute(delete(tables.Story).where(tables.Story.project_id == project_id))
    session.execute(delete(tables.Sprint).where(tables.Sprint.project_id == project_id))
    session.flush()

    starts = {number: now - timedelta(days=LENGTH_DAYS * (5 - number)) for number in range(1, 6)}
    goals = {1: "The foundations: the repository, the database and accounts.", 2: "Tasks: create, list, assign.",
             3: "The team's workspace: invitations, profiles and files.", 4: "Quality and speed before the release.",
             5: "The team lead's view: the dashboard and notifications."}
    sprints = {}
    for number, start in starts.items():
        running = number == 5
        sprints[number] = tables.Sprint(
            project_id=project_id, sprint_id=f"{key}-S{number}", name=f"Sprint {number}", goal=goals[number],
            status="active" if running else "closed", length_days=LENGTH_DAYS, capacity_points=CAPACITY,
            started_at=start, planned_end=start + timedelta(days=LENGTH_DAYS),
            closed_at=None if running else start + timedelta(days=LENGTH_DAYS, hours=-2),
            created_at=start - timedelta(days=2))
        session.add(sprints[number])
    session.flush()

    carried: list[tuple[tables.Story, Item]] = []
    for position, item in enumerate(STORIES, start=1):
        sprint = sprints.get(item.sprint)
        created = (starts[item.sprint] if item.sprint else starts[4]) - timedelta(days=3, hours=position % 7)
        story = tables.Story(
            project_id=project_id, story_id=f"{key}-{position}", title=item.title, description=item.description,
            acceptance_criteria=item.criteria, issue_type=item.issue_type, priority=item.priority,
            story_points=item.final_points or item.points, epic=item.epic, blocked_by=item.blocked_by,
            depends_on=item.depends_on, needed_by=item.needed_by, status="done", rank=float(position),
            sprint_id=None, source="import", synthetic=True, reopened=item.reopened, created_at=created,
            updated_at=created)
        session.add(story)
        session.flush()
        if sprint is not None:
            _commit_to(session, story, item, sprint, item.sprint, position)
        else:
            story.status = item.status
        if item.spills and item.sprint is not None:
            carried.append((story, item))
        story.upstream = signals.signals_for(story)

    # Stories not finished in their sprint carry on in the next one.
    for story, item in carried:
        following = sprints[item.sprint + 1]
        next_item = Item(item.sprint + 1, item.title, item.issue_type, story.story_points, item.priority, item.epic,
                         item.description, item.criteria, status=item.status)
        _commit_to(session, story, next_item, following, item.sprint + 1, int(story.story_id.rsplit("-", 1)[1]))
    session.commit()
    return [sprints[number].sprint_id for number in sorted(sprints)]


def _commit_to(session: Session, story: tables.Story, item: Item, sprint: tables.Sprint, number: int,
               position: int) -> None:
    """Put the story into the sprint as committed at its start, and settle how it went there."""
    start = sprint.started_at
    running = sprint.status == "active"
    story.sprint_id = sprint.sprint_id
    finished = not item.spills and not running
    if story.started_at is None and (finished or item.spills or item.status == "in_progress"):
        # In the running sprint, work started when the sprint did: a later time would still be in the future, and
        # marking the story done before then would make it "resolved before work started".
        story.started_at = start if running else start + timedelta(days=1 + (position % 6), hours=position % 5)
    if finished:
        days = 1.5 + (item.final_points or item.points) / 2
        resumed = max(story.started_at, start + timedelta(days=1))  # a carried story is finished in this sprint
        story.resolved_at = min(resumed + timedelta(days=days), sprint.closed_at - timedelta(hours=3))
        story.status = "done"
    else:
        story.status = "in_progress" if item.status == "in_progress" or item.spills else "to_do"
    session.add(tables.SprintItem(
        project_id=story.project_id, sprint_id=sprint.sprint_id, story_id=story.story_id, committed_at=start,
        added_mid_sprint=False, points_at_commit=item.points, left_at=None,
        points_at_close=None if running else (item.final_points or item.points),
        done_in_sprint=None if running else finished))


def stale_effort_sprints(known: list[str], current: list[str]) -> list[str]:
    """The sprints the effort service holds for the project that are no longer the platform's."""
    return [sprint_id for sprint_id in known if sprint_id not in current]


def existing_story_count(session: Session, project_id: str) -> int:
    return len(list(session.scalars(select(tables.Story.story_id).filter_by(project_id=project_id))))
