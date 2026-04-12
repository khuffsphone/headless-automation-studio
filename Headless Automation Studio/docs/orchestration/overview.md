# Multi-Agent Orchestration Overview

## Source of Truth: GitHub

GitHub is the single control plane for all work. Every task originates as a GitHub Issue, every deliverable lands in a Pull Request, and labels drive automated routing between agents. No work happens outside of a tracked issue and branch.

## Roles

| Role | Actor | Trigger |
|---|---|---|
| Primary Builder | Codex or Cursor | Assigned via `build:codex` or `build:cursor` label |
| Scrutinizer / Reviewer | Antigravity | Assigned via `review:ag` label on open PR |
| QA Finisher | Jules | Assigned via `qa:jules` label on open PR |
| Router | n8n | Listens to GitHub webhook events and dispatches agent calls |

## One Builder Per Branch

Each feature branch maps to exactly one builder agent. Builders do not share branches. Once a branch is opened as a PR, the builder's role is complete. All subsequent work (review, QA fixes) happens via comments, additional commits from Jules, or suggestions from Antigravity — not by re-assigning the builder.

## Antigravity — Adversarial Reviewer

Antigravity acts as a critical, skeptical reviewer. It reads the issue, the PR diff, and any linked context. It does not rebuild features — it identifies risks, regressions, edge cases, and UX inconsistencies, and outputs a structured findings report as a PR comment.

## Jules — Async QA Finisher

Jules is a background async agent. It receives the branch, repo, and a structured prompt payload. It validates CI, repairs failing tests, adds regression coverage, and commits narrow fixes. Jules does not redesign features; it finishes and hardens them.

## n8n — Event Router

n8n runs as a local or hosted service and subscribes to GitHub webhook events (issues, PRs, labels, comments). It uses a router workflow to dispatch the correct agent based on the event type and label combination.

## Label-Based Routing

Labels on GitHub Issues and PRs are the primary signal for routing. Adding a label triggers a webhook event, which n8n intercepts and routes to the correct downstream handler. See `docs/orchestration/labels.md` for the full label taxonomy and routing rules.

## The PR as Handoff Object

A Pull Request is the canonical handoff object between stages:
- **Builder → Antigravity**: PR opened + `review:ag` label applied
- **Antigravity → Jules**: Antigravity posts findings comment + `qa:jules` label applied
- **Jules → Merge**: Jules commits fixes, posts summary comment, `status:ready` applied
- **Human Review**: Any label containing `status:needs-human` pauses automation and requires manual action

The PR description template captures intent, risk, and reviewer focus areas in a structured format that all agents can parse.
