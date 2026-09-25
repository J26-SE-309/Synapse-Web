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

1. Work only on your own branch. Do not push to anyone else's branch.
2. Nobody pushes directly to `dev` or `main`.
3. To get your work into `dev`, open a pull request from your branch into `dev`.
4. Every pull request into `dev` must pass the automated checks. These checks confirm that the change does not break, modify or remove another developer's work.
5. [@Nikeshala22](https://github.com/Nikeshala22) reviews the pull request and merges it once the checks pass.
6. `main` is updated from `dev` by [@Nikeshala22](https://github.com/Nikeshala22) when `dev` is stable.

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
