# Synapse Web

> The frontend of **Synapse**, an AI-assisted agile project platform built by research group **J26-SE-309**.

![Status](https://img.shields.io/badge/status-initial%20setup-orange)

## Overview

Synapse Web is the single user interface for the Synapse platform. It brings together the four backend microservices listed below into one application. All four developers work in this repository, each on their own branch.

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

Each developer owns one folder. Keep your pages, components, hooks, API clients and tests inside it.

| Branch | Owner | Service | Your folder |
|---|---|---|---|
| `nikeshala` | [@Nikeshala22](https://github.com/Nikeshala22) | Effort Estimation and Sprint Risk Predictor | `src/modules/effort-estimation/` |
| `ama` | [@AmaLiyanage](https://github.com/AmaLiyanage) | Requirement Quality and Ambiguity Analyzer | `src/modules/requirement-quality/` |
| `lakviru` | [@dinuwa2500](https://github.com/dinuwa2500) | Requirement Traceability Engine | `src/modules/traceability/` |
| `sathmi` | [@lewkes](https://github.com/lewkes) | User Story Refinement and Acceptance Criteria Generator | `src/modules/story-refinement/` |

Everything outside these folders is **shared** (for example `package.json`, `src/shared/`, routing and app config). `.github/` is **lead-only**. Ownership is defined in [`.github/ownership.json`](.github/ownership.json).

### Pull Request Checks

| Check | What it does |
|---|---|
| **Ownership guard** | Fails if the pull request adds, edits, deletes or renames a file in another developer's folder. Fails if it changes shared files, until [@Nikeshala22](https://github.com/Nikeshala22) approves the pull request. Fails if a non-lead branch changes `.github/`. Also makes sure pull requests into `dev` come from a developer branch opened by its owner (or the lead), and pull requests into `main` come only from `dev`. |
| **Build and test** | Installs dependencies, then runs lint, type-check, **everyone's** tests and the production build. A change that breaks another module fails here even if it never touches that module's files. |

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

```bash
git clone https://github.com/J26-SE-309/Synapse-Web.git
cd Synapse-Web
git checkout <your-branch>
```

The tech stack, setup and run instructions will be added once the frontend is scaffolded.

## Project Lead

- [@Nikeshala22](https://github.com/Nikeshala22)
