# Walkthrough — HAS-006: Post-Debate Execution Brief Enforcer

**Commit:** `00a771a`
**Repo:** `headless-automation-studio`
**Date:** 2026-04-28
**Status:** Complete

---

## Files Changed

| File | Action | Purpose |
|---|---|---|
| `src/lib/briefEnforcer.ts` | **NEW** | Pure deterministic enforcer — 10 section validators + brief normalizer |
| `src/lib/storage.ts` | **MODIFIED** | `BriefEnforcementError` class + enforcer call in `writeAgBridgeFile` before any I/O |
| `src/app/api/decision/[id]/export/route.ts` | **MODIFIED** | `BriefEnforcementError` catch → structured 422 with `enforcement_errors[]` |
| `src/components/DecisionLog.tsx` | **MODIFIED** | Per-section enforcement error rendering in export row |

---

## How the Enforcer Works

`src/lib/briefEnforcer.ts` exports a single pure function:

```ts
enforceExecutionBrief(decision: Decision): BriefEnforcerResult
```

**Properties:**
- Deterministic — no model calls, no I/O, no side effects
- Does not mutate the incoming `Decision` record
- Returns `{ valid: true, brief: string, warnings: string[] }` or `{ valid: false, errors: BriefValidationError[], warnings: string[] }`

**The 10 section validators (in order):**

| # | Section | Rule |
|---|---|---|
| 1 | Role | Must be an explicit `## Role` heading with non-vague content. `decision.source` is not a substitute. |
| 2 | Objective | Must be `## Objective` with ≥20 chars of substantive content. |
| 3 | Hard Scope Boundary | Must be a heading with content. `constraints[]` alone is insufficient without the heading. |
| 4 | Execution Gate | Advisory — checks for inspect-before-write language. Always injected at export regardless. |
| 5 | Implementation Requirements | Must be a heading with ≥30 chars of substantive content. |
| 6 | Acceptance Criteria | Must contain `- [ ]` checkbox items. `DecisionQualityChecklist` booleans are not a substitute. |
| 7 | Explicit Out-of-Scope | Must be a heading with at least one `-` list item. `scope_out_identified: true` alone is not a substitute. |
| 8 | Expected Output | Must be a heading with ≥20 chars of content. |
| 9 | Verification | Must contain a code block or command-like line. |
| 10 | Walkthrough Artifact | Must be a heading with ≥15 chars stating what to produce. `ready_for_execution: true` is not a substitute. |

**Vagueness check:** Content under each heading is tested for placeholder patterns (`TBD`, `N/A`, `[...]`, `TODO`, `none`, `-`, or fewer than 8 characters).

**Section extraction:** Uses heading-level-aware parsing — collects lines until the next heading of equal or higher level.

---

## How Export Behavior Changed

### Before HAS-006

`writeAgBridgeFile(decision)` wrote an export file unconditionally if the decision was eligible. The file contained the raw `accepted_proposal` string verbatim. No structural validation was performed — a one-line vague proposal would export successfully.

### After HAS-006

`writeAgBridgeFile(decision)` now:
1. Calls `enforceExecutionBrief(decision)` **before creating any file**
2. If invalid: throws `BriefEnforcementError` (structured, named error class with `errors[]` and `warnings[]`)
3. If valid: writes the **normalized brief** (all 10 sections present and structured) instead of the raw proposal

The export route catches `BriefEnforcementError` specifically and returns:

```json
HTTP 422
{
  "error": "brief_enforcement_failed",
  "message": "Execution brief failed validation (9 errors): Role, Objective, ...",
  "enforcement_errors": [
    { "section": "Role", "message": "Missing required '## Role' section. The `source` field is not a substitute." },
    ...
  ],
  "enforcement_warnings": []
}
```

Unexpected errors still return HTTP 500 `bridge_write_failed`.

---

## Example: Validation Failure

**Input proposal:** `"We should do CI."`

**Result:** `{ valid: false, errors: [...9 items...] }`

```
Sections flagged:
  [Role]                        Missing required '## Role' section. The exported brief
                                must state a specific execution role...
  [Objective]                   Missing required '## Objective' section...
  [Hard Scope Boundary]         Missing '## Hard Scope Boundary' heading...
  [Implementation Requirements] Missing required '## Implementation Requirements' section...
  [Acceptance Criteria]         Missing required '## Acceptance Criteria' section with
                                checkbox items. The DecisionQualityChecklist boolean fields
                                do not satisfy this requirement.
  [Explicit Out-of-Scope]       Missing required '## Explicit Out-of-Scope' section...
  [Expected Output]             Missing required '## Expected Output' section...
  [Verification]                Missing required '## Verification Commands / Manual Checks'...
  [Walkthrough Artifact Requirement] Missing required '## Walkthrough Artifact Requirement'
                                section. `ready_for_execution: true` does not satisfy this
                                requirement.
```

**No file written** — `has-data/exports/antigravity-tasks/` file count unchanged.

---

## Example: Valid Exported Brief Structure

A compliant proposal (containing all 10 sections with substantive content) produces a normalized brief of ~2,100 chars with the following structure in the exported `.md` file:

```
# Antigravity Task — [scope]

**Decision ID:** ...
**Exported at:** ...

## ⚠️ Execution gate — operator confirmation required
[mandatory gate block — always injected]

---

## Originating question
[verbatim originating question]

## Normalized Execution Brief

## Role
[non-vague execution role from proposal]

## Objective
[bounded objective from proposal]

## Hard Scope Boundary
[scope statement from proposal]

## Execution Gate — Inspect Before Write
[standard 6-point inspect gate]

## Implementation Requirements
[concrete requirements from proposal]

## Acceptance Criteria
- [ ] [testable criterion]
- [ ] [testable criterion]

## Explicit Out-of-Scope
- [excluded item]
- [excluded item]

## Expected Output
Return:
1. Files changed
...

## Verification Commands / Manual Checks
```[commands]```

## Walkthrough Artifact Requirement
[path convention and required content]

## Operator rationale / Dependencies / Constraints / Quality checklist
[structured decision metadata]
```

---

## Commands Run

```powershell
# Type check
npx tsc --noEmit
# → 0 errors

# Production build
npm run build
# → ✓ Compiled successfully, all 5 routes emitted

# Smoke test (Node 24 --experimental-strip-types)
node --experimental-strip-types scripts/smoke-test-has-006.mjs
```

---

## Smoke Test Results

```
── Test A: Vague proposal → enforcement failure ──────────────
  ✅ enforcer returns valid=false for vague proposal
  ✅ error includes Role
  ✅ error includes Objective
  ✅ error includes Acceptance Criteria
  ✅ error includes Walkthrough Artifact Requirement
  ✅ all errors have section + message
  ✅ no partial file written on failure

── Test B: Compliant proposal → valid brief ──────────────────
  ✅ enforcer returns valid=true for compliant proposal
  ✅ normalized brief contains: Role
  ✅ normalized brief contains: Objective
  ✅ normalized brief contains: Hard Scope Boundary
  ✅ normalized brief contains: Execution Gate
  ✅ normalized brief contains: Implementation Requirements
  ✅ normalized brief contains: Acceptance Criteria
  ✅ normalized brief contains: Explicit Out-of-Scope
  ✅ normalized brief contains: Expected Output
  ✅ normalized brief contains: Verification
  ✅ normalized brief contains: Walkthrough Artifact
  ✅ normalized brief has checkbox items

── Test C: API — export executed decision → 422 not_eligible ──
  ✅ returns 422 for executed decision
  ✅ error=not_eligible

── Test D: API — export eligible non-compliant → 422 enforcement ──
  ✅ returns 422 brief_enforcement_failed
  ✅ enforcement_errors is array
  ✅ enforcement_errors is non-empty
  ✅ no partial file written on enforcement failure
  Sections blocked: Role, Objective, Hard Scope Boundary,
    Implementation Requirements, Acceptance Criteria,
    Explicit Out-of-Scope, Expected Output, Verification,
    Walkthrough Artifact Requirement

Smoke test complete — 25 passed, 0 failed
```

---

## Known Limitations

1. **No automated unit test suite** — `briefEnforcer.ts` is a pure function and is structured for easy unit testing, but no test runner (Vitest, Jest) is configured in HAS. The smoke test script covers the critical paths but is not wired into CI.

2. **Heading-in-code-block false negative** — If a proposal contains a heading string inside a fenced code block (e.g., `` `## Role` ``), the extractor may incorrectly match it as a section. Acceptable for current operator-authored proposals.

3. **Existing decisions are not retroactively enforced** — All 14 decisions in `decisions.json` predate HAS-006. They would fail enforcement if re-exported. This is intentional: enforcement only activates at the export step and does not mutate prior records.

4. **Section alias coverage** — Some section names have multiple aliases (e.g., "Verification Commands", "Commands to Run"). Unusual variations could be missed. Aliases can be expanded in `briefEnforcer.ts` as patterns emerge.

5. **Advisory Execution Gate check** — Section 4 (Execution Gate) is downgraded to a warning rather than a hard error, because the gate block is always injected by `writeAgBridgeFile` regardless. If a future change removes the injection, this should be promoted to a hard error.

---

## Recommended Next Task: HAS-007 — Pre-Debate Input Lint

**Rationale:** HAS-006 hardened the output (export) stage. The symmetric gap is the input (question) stage: operators can submit questions that are too vague to produce good synthesis. A pre-debate input linter would:

- Check the submitted question for minimum specificity (length, presence of a `?` or explicit ask, absence of single-word queries)
- Reject or warn before dispatching to all three providers
- Prevent the "garbage in, garbage out" failure mode where a vague question produces three proposals that all pass enforcement by coincidence

**Scope of HAS-007 (proposed):**
- Add `src/lib/questionLinter.ts` — pure deterministic checks on the operator question string
- Wire into `POST /api/ask` before dispatch
- Surface lint errors in `OperatorInput.tsx` before submission
- No model calls, no new agents, no schema changes
