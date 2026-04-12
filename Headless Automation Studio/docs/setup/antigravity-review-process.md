# Antigravity Review Process

This document defines how Antigravity participates in the multi-agent workflow, its boundaries, and what operators should expect from a review pass.

---

## When Antigravity Is Invoked

Antigravity is invoked when the `review:ag` label is applied to an open Pull Request. This typically happens immediately after a builder agent (Codex or Cursor) opens the PR.

The n8n router intercepts the `pull_request.labeled` webhook event for `review:ag` and triggers the Antigravity review flow.

---

## What Antigravity Does

Antigravity performs a structured adversarial review of:
- The originating GitHub Issue (objective, scope, constraints, acceptance criteria)
- The Pull Request description (what changed, stated risk, manual test steps)
- The code diff (all changed files)
- The test suite changes (coverage, correctness, missing cases)

Antigravity outputs a structured findings report posted as a PR comment. See `docs/prompts/antigravity-scrutinizer.md` for the full prompt and output format.

---

## Findings vs. Rewrites

**Antigravity posts findings — it does not rewrite code.**

Each finding includes:
- A severity rating (Blocker, Warning, Note)
- The specific file and behavior concerned
- A precise description of the risk
- A recommended fix (described, not applied)

If a fix is trivially obvious, Antigravity may describe it with precision, but commits nothing to the branch. All code changes remain the responsibility of the builder or Jules.

---

## Scope Discipline

Antigravity respects task scope. It will not:
- Flag issues that are explicitly out-of-scope for the task
- Demand architectural changes that weren't in the task
- Suggest feature expansions
- Attempt to override the PR author's design decisions without justification

Out-of-scope observations may be noted as informational items but will not be treated as blockers.

---

## Scratch Branch Policy

In rare cases — where a finding is critical and the fix is well-defined — Antigravity may request permission from the operator to use a scratch branch for demonstrating a fix. This is exceptional behavior and requires explicit operator approval. Antigravity should **not**:
- Push to the builder's feature branch without operator approval
- Create a long-lived branch that becomes a co-development branch
- Take ownership of the feature branch or PR

The default behavior is to post findings and stop. The operator decides what happens next.

---

## After the Review Pass

Once Antigravity posts its findings comment:
1. The operator reviews the findings
2. If blockers exist, the operator may ask the builder to address them, or route to Jules
3. The operator applies `qa:jules` to dispatch Jules for the QA pass
4. If issues require human judgment, the operator applies `status:needs-human`

Antigravity is **not re-invoked automatically** after Jules commits fixes. A second Antigravity pass requires the operator to remove and re-apply `review:ag`, or to manually invoke a review session.

---

## What Antigravity Is Not

| ❌ Not this | ✅ This instead |
|---|---|
| A co-author of the feature | An adversarial one-pass reviewer |
| A replacement for Jules | A complement to Jules — different role |
| An autonomous fixer | A structured findings reporter |
| A gatekeeper that blocks indefinitely | A one-pass check that surfaces risk |
