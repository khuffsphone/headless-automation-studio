# Agent Workflow — Operator Guide

This document describes how to operate the multi-agent development workflow. It is the starting point for anyone running the system for the first time.

---

## Overview

This workflow uses GitHub as the control plane, n8n as the event router, and three agent roles to take a feature from issue to merge-ready PR without continuous human involvement.

| Agent | Role |
|---|---|
| **Codex / Cursor** | Primary builder — implements the scoped feature |
| **Antigravity** | Adversarial reviewer — finds risks and regressions |
| **Jules** | Async QA finisher — validates CI, hardens tests, fixes narrow defects |
| **n8n** | Router — listens to GitHub webhooks, dispatches agent sessions |

---

## Branch Flow

```
main
 └── feat/ISSUE-<N>-short-name   ← builder works here
      └── PR opened              ← review:ag applied
           └── Antigravity reviews, posts findings
                └── qa:jules applied
                     └── Jules hardens, commits, posts summary
                          └── status:ready applied
                               └── Human reviews and merges to main
```

One issue → one branch → one PR → one Antigravity pass → one Jules pass → merge.

---

## Order of Operations

### 1. Create Issue
- Go to GitHub → Issues → New Issue → select **Task** template
- Fill in: Objective, Scope, Constraints, Acceptance Criteria, Files Likely Affected, Reviewer Focus
- Submit the issue. Note the issue number (e.g., `#123`)

### 2. Assign Builder Label
- Apply either `build:codex` or `build:cursor` to the issue
- n8n receives the `issues.labeled` webhook event
- For `build:codex`: n8n dispatches a Codex session with the task payload
- For `build:cursor`: operator starts a Cursor session manually using the prompt in `docs/prompts/primary-builder.md`
- The builder creates branch `feat/ISSUE-<N>-short-name` and implements the task

### 3. Open PR
- Builder opens a PR from the feature branch targeting `main`
- PR description follows the pull request template (`.github/pull_request_template.md`)
- Apply the `review:ag` label to the PR

### 4. Antigravity Review
- n8n receives the `pull_request.labeled` event for `review:ag`
- Antigravity reviews the issue, PR diff, and changed files
- Antigravity posts a structured findings comment (see `docs/orchestration/agent-status-format.md`)
- Operator reads findings and decides: proceed, ask builder to fix, or escalate

### 5. Add `qa:jules`
- After reviewing Antigravity's findings, the operator applies `qa:jules` to the PR
- n8n dispatches a Jules session with the repo, branch, and finisher prompt
- If there are unresolved blockers from Antigravity, include them in the Jules prompt context

### 6. Jules Pass
- Jules runs asynchronously: validates CI, repairs failing tests, addresses Antigravity blockers
- Jules commits narrow fixes to the feature branch
- Jules posts a structured summary comment on the PR
- n8n (or Jules) applies `status:ready` if the pass was clean, or `status:needs-human` if escalation is required

### 7. Merge
- Operator reviews the PR, Antigravity findings, and Jules summary
- If `status:ready` is applied and the operator agrees, merge the PR to `main`
- Delete the feature branch after merge

---

## Stopping the Automation

At any point, apply `status:blocked` or `status:needs-human` to pause automated dispatch. These labels suppress n8n routing until they are removed.

---

## Further Reading

- `docs/orchestration/overview.md` — Architectural overview
- `docs/orchestration/labels.md` — Full label taxonomy and routing rules
- `docs/orchestration/agent-status-format.md` — Machine-readable PR comment format
- `docs/prompts/` — Agent prompt templates
- `docs/setup/local-setup-checklist.md` — First-time setup guide
- `n8n/workflows/README.md` — n8n workflow import instructions and placeholder guide
