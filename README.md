# Synapse Web

> The web app, API gateway and shared contracts of **Synapse**, an AI-assisted agile project platform built by research group **J26-SE-309**.

![Status](https://img.shields.io/badge/status-initial%20setup-orange)

## Overview

Synapse Web is the single user interface for the Synapse platform, plus the pieces all four components share:

- **Web app** (Next.js 16, React 19, TypeScript, Tailwind CSS 4, shadcn/ui on Radix): one page area per component inside a shared shell (sidebar, top bar with the project picker, light and dark themes).
- **API gateway and orchestration engine** (`gateway/`, FastAPI): the only address the web app calls. It forwards `/api/v1/<component>/...` to each component's service and runs the full pipeline (`POST /api/v1/pipeline/run`): quality analysis, then story refinement, then traceability, then effort and sprint-risk prediction. It also owns the platform's **projects** (`/api/v1/projects`), which every component keys its data by, and each project's **backlog and sprints** (`/api/v1/projects/{id}/stories`, `/sprints`).
- **Contracts** (`contracts/`): the JSON Schemas of the data the components exchange.

All four developers work in this repository, each on their own branch.

## Repository Layout

```
Synapse-Web/
├── src/
│   ├── app/
│   │   ├── layout.tsx, page.tsx      # app shell and overview page (shared)
│   │   ├── (platform)/               # the platform's own pages: backlog/, sprints/ (shared)
│   │   └── (modules)/                # one folder per component, owned by its developer
│   │       ├── requirement-quality/  #   Ama
│   │       ├── story-refinement/     #   Sathmi
│   │       ├── traceability/         #   Lakviru
│   │       └── effort-estimation/    #   Nikeshala
│   ├── shared/                       # shared:
│   │   ├── ui/                       #   the UI kit (shadcn/ui on Radix): buttons, forms, dialogs, tables, charts…
│   │   ├── shell/                    #   sidebar, top bar, skip link
│   │   ├── projects/                 #   the project picker, "New project" and ProjectGate
│   │   ├── backlog/                  #   the Backlog and Sprints pages, story and sprint forms
│   │   ├── sprint-panels.ts          #   what each component shows on a sprint's page
│   │   ├── theme/                    #   light / dark / system
│   │   ├── components/, hooks/, api/ #   page header, status badges, the gateway client
│   │   └── navigation.ts             #   the sidebar and breadcrumbs (modules register their _nav.ts here)
│   └── test/                         # test setup and the accessibility check (axe.ts)
├── gateway/                          # FastAPI API gateway, orchestration engine and projects (port 8000)
├── contracts/                        # JSON Schemas + examples, one folder per component
├── docker-compose.yml                # web app + gateway + the gateway's own database
└── .github/                          # CI, ownership rules (lead-only)
```

## Synapse Platform Services

| Service | Repository | Type |
|---|---|---|
| **Synapse Web** | [Synapse-Web](https://github.com/J26-SE-309/Synapse-Web) | Frontend |
| Effort Estimation and Sprint Risk Predictor | [Effort-Estimation-and-Sprint-Risk-Predictor](https://github.com/J26-SE-309/Effort-Estimation-and-Sprint-Risk-Predictor) | Backend + ML engine |
| Requirement Quality and Ambiguity Analyzer | [Requirement-Quality-and-Ambiguity-Analyzer](https://github.com/J26-SE-309/Requirement-Quality-and-Ambiguity-Analyzer) | Backend + ML engine |
| Requirement Traceability Engine | [Requirement-Traceability-Engine](https://github.com/J26-SE-309/Requirement-Traceability-Engine) | Backend + ML engine |
| User Story Refinement and Acceptance Criteria Generator | [User-Story-Refinement-Acceptance-Criteria-Generator](https://github.com/J26-SE-309/User-Story-Refinement-Acceptance-Criteria-Generator) | Backend + ML engine |

## Branching Model

| Branch | Purpose | Who merges into it |
|---|---|---|
| `main` | Stable, release-ready code | [@Nikeshala22](https://github.com/Nikeshala22) only, from `dev` |
| `dev` | Integration branch for everyone's work | [@Nikeshala22](https://github.com/Nikeshala22) only, through a pull request |
| `nikeshala` | Nikeshala's work | Nikeshala |
| `ama` | Ama's work | Ama |
| `lakviru` | Lakviru's work | Lakviru |
| `sathmi` | Sathmi's work | Sathmi |

### Contribution Rules

1. Work only on your own branch. Each personal branch accepts pushes only from its owner and [@Nikeshala22](https://github.com/Nikeshala22).
2. Nobody pushes directly to `dev` or `main`, including the lead. All changes arrive through pull requests.
3. To get your work into `dev`, open a pull request from your branch into `dev`.
4. Every pull request into `dev` must pass the automated checks below. They confirm that the change does not break, modify or remove another developer's work.
5. [@Nikeshala22](https://github.com/Nikeshala22) reviews the pull request and is the only person who can merge it, once the checks pass.
6. `main` is updated only by a pull request from `dev`, merged by [@Nikeshala22](https://github.com/Nikeshala22) when `dev` is stable.

### Module Ownership

Each developer owns their module's route folder and their component's contract folder. Keep your pages, components (`_components/`), hooks and API calls (`_lib/`) and tests inside your route folder; Next.js ignores folders that start with `_` for routing.

| Branch | Owner | Service | Your folders |
|---|---|---|---|
| `nikeshala` | [@Nikeshala22](https://github.com/Nikeshala22) | Effort Estimation and Sprint Risk Predictor | `src/app/(modules)/effort-estimation/` and `contracts/effort-estimation/` |
| `ama` | [@AmaLiyanage](https://github.com/AmaLiyanage) | Requirement Quality and Ambiguity Analyzer | `src/app/(modules)/requirement-quality/` and `contracts/requirement-quality/` |
| `lakviru` | [@dinuwa2500](https://github.com/dinuwa2500) | Requirement Traceability Engine | `src/app/(modules)/traceability/` and `contracts/traceability/` |
| `sathmi` | [@Sathmi-Ruwanya](https://github.com/Sathmi-Ruwanya) | User Story Refinement and Acceptance Criteria Generator | `src/app/(modules)/story-refinement/` and `contracts/story-refinement/` |

Everything outside these folders is **shared** (for example `package.json`, `src/shared/`, `src/app/layout.tsx`, `gateway/` and `contracts/common/`). `.github/` is **lead-only**. Ownership is defined in [`.github/ownership.json`](.github/ownership.json).

## Building a Module's Pages

The shell, theme and UI kit are shared, so every module looks and behaves the same. Build your pages from them:

| Need | Use |
|---|---|
| Buttons, inputs, selects, dialogs, menus, tables, tabs, toasts, charts | `@/shared/ui/*` (shadcn/ui on Radix: keyboard and screen-reader support built in). Missing one? `npx shadcn@latest add <name>` puts it in `src/shared/ui/` (a shared file, so it needs Nikeshala's approval). |
| A page title | `PageHeader` from `@/shared/components/PageHeader`: the page's one `<h1>`, its description and actions. Sections below use `<h2>`. |
| The chosen project | Wrap project pages in `<ProjectGate>{(project) => …}</ProjectGate>` (`@/shared/projects/ProjectGate`); it asks for a project when none is chosen. `useProject()` gives the id elsewhere. |
| Your pages in the sidebar | List them in `src/app/(modules)/<your-module>/_nav.ts` (yours), and register that list once in `src/shared/navigation.ts` (shared). |
| Calling your service | `gatewayFetch("api/v1/<your-module>/…")` with TanStack Query; `describeError(error)` turns any failure into a sentence for people. |
| Your part of a sprint's page | Build a panel in your folder that takes `{ project, sprint, stories }` (`SprintPanelProps`), and register it once in `src/shared/sprint-panels.ts` (shared). The effort module's `SprintEstimates` is the example. |
| The project's stories and sprints | `useStories(projectId)`, `useSprints(projectId)` from `@/shared/backlog/api`; types in `@/shared/backlog/types`. |

**Theme.** Indigo accent on cool grey (slate), in light and dark; people choose Light, Dark or System in the top bar. Use the colour tokens, never fixed colours, so both themes work: `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border`, `bg-primary` / `text-primary`. Green, amber and red (`text-success`, `text-warning`, `text-danger` and their `-soft` backgrounds) are kept for status and risk.

**Validation in the browser.** Forms use React Hook Form with a Zod schema whose rules are your contract's (lengths, minimums, required fields), so problems show before anything is sent; the service still checks everything. On each field: a `<FieldLabel>`, `aria-invalid`, and a `<FieldError>` tied to it with `aria-describedby`. Put a server's 422 back on the field it names. A test should read your `contracts/<module>/*.schema.json` and check the form's limits match it (see `src/shared/projects/schema.test.ts`).

**Accessibility (NFR11, WCAG 2.1 AA).** Never show meaning by colour alone (add a word or icon), keep everything usable with the keyboard, and check components in tests with `accessibilityProblems()` from `src/test/axe.ts` (it must return `[]`). Colour contrast is checked in a real browser, in both themes.

**Projects.** Projects belong to the platform: the gateway stores them (`GET` / `POST /api/v1/projects`, `GET` / `PATCH /api/v1/projects/{id}`, contracts in `contracts/common/project*.schema.json`), and the top bar's picker lists them. Keys are short capitals like `TUTOR` and never change, because every component stores its data under them.

**Backlog and sprints.** They belong to the platform too, not to a component. The **Backlog** page holds every story with its details (description, acceptance criteria, type, priority, points, epic, dependencies); stories are added by hand, imported from a JSON file, or, later, arrive from story refinement. On **Sprints**, the team plans a sprint, adds stories from the backlog, starts it (the stories are committed), moves stories along (To do, In progress, Done) and closes it (unfinished stories go back to the backlog as spilled over). The components give their opinion on a sprint's page: effort and spillover risk today. Every change to a started sprint is sent to the effort service (`PUT /api/v1/projects/{id}/sprints/{id}` there), which records each story's outcome against its estimate and builds the team's history; if it is unreachable, the sprint page says so and offers to send it again. Contracts: `contracts/common/story*.schema.json` and `sprint*.schema.json`.

### Pull Request Checks

| Check | What it does |
|---|---|
| **Ownership guard** | Fails if the pull request adds, edits, deletes or renames a file in another developer's folder. Fails if it changes shared files, until [@Nikeshala22](https://github.com/Nikeshala22) approves the pull request. Fails if a non-lead branch changes `.github/`. Also makes sure pull requests into `dev` come from a developer branch opened by its owner (or the lead), and pull requests into `main` come only from `dev`. |
| **Build and test** | Installs dependencies, then runs lint, type-check, **everyone's** tests and the production build of the web app, and the gateway's lint and tests, which also check every contract example against its schema. A change that breaks another module fails here even if it never touches that module's files. |

Merging also requires your branch to be up to date with `dev`, so the checks always run against everyone's latest work.

**Changing a shared file?** Say why in the pull request description. Once Nikeshala approves it, she re-runs the failed **Ownership guard** check (*Checks* tab → *Re-run jobs*). An approval only covers the commit it was given on, so pushing new commits needs a fresh approval.

> The guard's rules are read from `main`. Changes to `.github/ownership.json` take effect once they reach `main`.

### Keeping Your Branch Up to Date

Before opening a pull request, bring the latest `dev` into your branch and resolve any conflicts on your side:

```bash
git checkout <your-branch>
git fetch origin
git merge origin/dev
git push origin <your-branch>
```

## Getting Started

Requires Node.js 20.9 or later, Python 3.12, Docker Desktop and Git. Run these in PowerShell after cloning.

```powershell
git clone https://github.com/J26-SE-309/Synapse-Web.git
cd Synapse-Web
git switch <your-branch>
```

### Web app

```powershell
npm install
npm run dev
```

Open http://localhost:3000. Before pushing, run the same checks CI runs:

```powershell
npm run lint; npm run typecheck; npm run test; npm run build
```

### API gateway

```powershell
cd gateway
py -3.12 -m venv .venv
.venv\Scripts\python -m pip install -e ".[dev]"
.venv\Scripts\uvicorn app.main:app --reload --port 8000
```

Open http://localhost:8000/docs. The gateway expects the components on ports 8001–8004 (see `gateway/.env.example`); components that are not running show as *Not reachable* in the web app. Tests: `.venv\Scripts\python -m pytest` and `.venv\Scripts\ruff check .` from `gateway/`.

The gateway creates and updates its tables itself at start-up (Alembic migrations in `gateway/app/migrations`), so start its database first (`docker compose up -d platform-db`). To try the pages with the effort service's development teams, add them as projects (they are labelled *Synthetic* or *TAWOS replay* in the picker and can be removed again):

```powershell
.venv\Scripts\python -m app.devdata load     # or: list, delete
```

### Everything in Docker

- This repository only (web app, gateway and its database): `docker compose up --build`
- The whole platform: clone all five repositories into one folder and run `docker compose up --build` from that folder with the platform `docker-compose.yml` described in the team guide.

| Service | URL |
|---|---|
| Web app | http://localhost:3000 |
| API gateway | http://localhost:8000/docs |
| Gateway database | `localhost:5440`, database `platform_db`, user `platform_user` / `platform-local` |

## Project Lead

- [@Nikeshala22](https://github.com/Nikeshala22)
