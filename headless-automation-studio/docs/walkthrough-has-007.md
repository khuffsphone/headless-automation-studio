# Walkthrough — HAS-007: Pre-Debate Input Lint

**Commit:** `5861ccc` feat: HAS-007 — pre-debate input lint (7 rules, dual-layer gate)
**Repo:** `headless-automation-studio`
**Date:** 2026-04-28
**Status:** Complete

---

## Files Changed

| File | Action | Purpose |
|---|---|---|
| `src/lib/questionLinter.ts` | **NEW** | Pure, browser-safe, deterministic linter — 7 blocking rules |
| `src/components/OperatorInput.tsx` | **MODIFIED** | Client-side lint gate: blocks dispatch, shows inline per-rule errors |
| `src/app/api/ask/route.ts` | **MODIFIED** | Server-side lint gate: returns 422 `prompt_lint_failed` before message writes |
| `src/app/page.tsx` | **MODIFIED** | Handles 422 `prompt_lint_failed` from server with per-rule detail |
| `scripts/smoke-test-has-007.mjs` | **NEW** | 31-assertion smoke test covering all 7 rules + API no-write verification |
| `docs/walkthrough-has-007.md` | **NEW** | This document |

---

## Relationship to HAS-006

HAS-006 added a post-debate output enforcer. HAS-007 adds a pre-debate input linter. Together they form a complete quality gate:

```
Operator question
       │
  ┌────▼────────────────────┐
  │  HAS-007: questionLinter │  ← blocks vague, multi-objective, boundary-free prompts
  └────┬────────────────────┘
       │ valid only
  ┌────▼────────────────────┐
  │  Three-model debate room │
  └────┬────────────────────┘
       │ synthesis
  ┌────▼────────────────────┐
  │  HAS-006: briefEnforcer  │  ← blocks vague/incomplete execution briefs at export
  └────┬────────────────────┘
       │ normalized brief
  Antigravity execution
```

---

## How the Linter Works

`src/lib/questionLinter.ts` exports:

```ts
lintQuestion(question: string): LintResult
```

**Properties:**
- Pure function — no I/O, no side effects, no async
- Deterministic — same input always produces same output
- Browser-safe — no `fs`, `path`, `process`, or any Node-only API
- Synchronous

**Return type:**
```ts
type LintResult =
  | { valid: true; warnings: string[] }
  | { valid: false; errors: LintError[]; warnings: string[] }

interface LintError {
  rule_id: string;
  message: string;
  recommended_fix: string;
}
```

Lint failures are **blocking** — they are returned in `errors[]`, not `warnings[]`. Advisory items use `warnings[]` and do not block dispatch. Currently no rules produce warnings; the distinction is reserved for future use.

---

## The 7 Rules

| # | Rule ID | Triggers when |
|---|---|---|
| 1 | `too_short` | Prompt < 20 characters |
| 2 | `vague_phrase` | Contains one of 10 vague phrases (`production-ready`, `modernize`, `best practices`, `improve`, `enhance`, `optimize`, `robust`, `comprehensive`, `end-to-end`, `full pipeline`) without a concrete anchor in the following 80 chars |
| 3 | `multi_objective` | Contains ≥2 distinct imperative verbs separated by ` and ` |
| 4 | `implementation_no_criteria` | Contains implementation verbs (`implement`, `build`, `create`, `add`, `write`) without criteria signals (`should`, `must`, `passes`, `returns`, `validates`, etc.) |
| 5 | `execution_no_boundary` | Contains execution verbs (`implement`, `build`, `deploy`, `run`, `execute`, `perform`) without scope-exclusion signals (`do not`, `only`, `except`, `exclude`, `out of scope`, etc.) |
| 6 | `agent_ambiguity` | Contains `agent`, `automation`, `integration`, or `workflow` without a planning qualifier (`planning-only`, `code-changing`, `no code`, `read-only`, etc.) |
| 7 | `scope_too_broad` | Contains scope-maximizing language (`entire`, `everything`, `whole`, `complete rewrite`, `all of the`, `full system`) without a bounded deliverable (file path, quoted name, or scoping word) |

**Vague phrase context suppression (Rule 2):** A vague phrase is not flagged if the 80 characters following it contain a concrete anchor: a colon, `by `, `to ensure`, `so that`, `when`, `where`, a file extension, a quoted string, or a number. This prevents false positives on prompts like *"ensure the pipeline is production-ready by verifying `npm run build` passes on every push."*

---

## How Dispatch Behavior Changed

### Before HAS-007

`POST /api/ask` accepted any non-empty string. A one-word stub or a vague phrase like *"improve HAS"* would dispatch to all three providers, consume tokens, and produce synthesis that could not produce an actionable execution brief.

### After HAS-007

**Client layer (primary):** `OperatorInput.tsx` runs `lintQuestion(trimmed)` on submit. If `valid=false`, `onSubmit` is not called, no fetch is made, and errors are rendered inline below the textarea. Errors clear when the operator edits the draft.

**Server layer (belt-and-suspenders):** `POST /api/ask` runs the same linter after the empty-check. On failure, it returns:

```json
HTTP 422
{
  "error": "prompt_lint_failed",
  "message": "Prompt blocked by input lint (3 issues): vague_phrase, agent_ambiguity, scope_too_broad",
  "lint_errors": [
    {
      "rule_id": "vague_phrase",
      "message": "The prompt uses 'production-ready' without defining what that means...",
      "recommended_fix": "Replace 'production-ready' with a concrete testable condition..."
    },
    ...
  ]
}
```

**No writes on failure:** `appendMessage`, `readThreads`, `callChatGPT/Gemini/Claude` — none are reached if lint fails. `messages.json` is unchanged.

---

## Example: Validation Failure

**Prompt:** `"Make everything production-ready and also add integration."`

**Lint result:**
```
valid: false
errors:
  [vague_phrase] The prompt uses 'production-ready' without defining what that means.
    → Replace 'production-ready' with a concrete testable condition...

  [implementation_no_criteria] The prompt asks for implementation but contains no
    acceptance-criteria signal.
    → Add at least one acceptance criterion...

  [agent_ambiguity] The prompt references 'integration' without specifying whether
    this task is planning-only or code-changing.
    → Add a qualifier such as 'planning-only', 'no code changes', or 'code-changing'...

  [scope_too_broad] The prompt uses scope-maximizing language ('everything') without
    identifying a bounded deliverable.
    → Replace the broad scope word with a specific, bounded deliverable...
```

**API response:** `422 prompt_lint_failed` with `lint_errors[]` matching the above.

**`messages.json` message count before:** 56 **after:** 56 — unchanged.

---

## Example: Valid Prompt (passes all 7 rules)

```
ARCHON-007 selection: HAS-006 added a post-debate brief enforcer. The pre-debate
input stage is currently unguarded. Should ARCHON-007 add a deterministic question
linter that blocks vague, multi-objective, or boundary-free prompts before dispatch?
If yes, define the minimum viable lint rule set. If not, recommend the better next step.

Constraints: do not add model calls. Do not modify briefEnforcer.ts. Only affect
src/lib/questionLinter.ts and the ask route.

Acceptance criteria: the lint must return structured errors, block dispatch on
failure, and pass the smoke test.
```

**Lint result:** `{ valid: true, warnings: [] }`

---

## Commands Run

```powershell
npx tsc --noEmit
# → TSC_CLEAN (0 errors)

npm run build
# → ✓ Compiled successfully in 2.6s, all 5 routes emitted

node --experimental-strip-types scripts/smoke-test-has-007.mjs
# → 31 passed, 0 failed
```

---

## Smoke Test Results

```
── Test 1: Vague phrase → blocked
  ✅ valid=false for vague prompt
  ✅ rule vague_phrase fired
  ✅ all errors have rule_id, message, recommended_fix

── Test 2: Too-short prompt → blocked
  ✅ valid=false for too-short prompt
  ✅ rule too_short fired

── Test 3: Multi-objective prompt → blocked
  ✅ valid=false for multi-objective prompt
  ✅ rule multi_objective fired

── Test 4: Implementation without acceptance criteria → blocked
  ✅ valid=false for implementation-no-criteria prompt
  ✅ rule implementation_no_criteria fired

── Test 5: Execution without out-of-scope boundary → blocked
  ✅ valid=false for execution-no-boundary prompt
  ✅ rule execution_no_boundary fired

── Test 6: Agent/workflow ambiguity → blocked
  ✅ valid=false for agent-ambiguity prompt
  ✅ rule agent_ambiguity fired

── Test 7: Scope-too-broad → blocked
  ✅ valid=false for scope-too-broad prompt
  ✅ rule scope_too_broad fired

── Test 8: Valid prompt → passes
  ✅ valid=true for well-formed prompt

── Tests 9–10: API — lint failure writes nothing
  ✅ API returns 422 for lint-failed prompt
  ✅ error code = prompt_lint_failed
  ✅ response includes lint_errors[]
  ✅ lint_errors[] is non-empty
  ✅ every lint_error has rule_id + message + recommended_fix
  ✅ messages.json unchanged (56 → 56)
  ✅ no provider calls (implied by zero message writes)

── Rule count: verify exactly 7 rule IDs
  ✅ all 7 rules fired at least once
  ✅ exactly 7 rule IDs defined

HAS-007 smoke test complete — 31 passed, 0 failed
```

---

## Known Limitations

1. **No unit test suite** — `questionLinter.ts` is a pure function and is structured for easy unit testing, but no test runner is configured in HAS. The smoke test covers all 7 rules but is not wired into CI.

2. **Vague-phrase context window is heuristic** — Rule 2 looks 80 chars ahead for concrete anchors. An edge case exists where a concrete anchor appears beyond 80 chars; the phrase would be incorrectly flagged. Tunable by adjusting `windowChars` in `isContextualized`.

3. **Rule interactions are additive** — Multiple rules can fire simultaneously (e.g. Rule 3 + Rule 5 on a multi-objective execution prompt). This is intentional and provides complete feedback, but some operators may find multiple errors on a single prompt surprising. No deduplication is applied.

4. **Rule 4 / Rule 5 overlap** — Both `implementation_no_criteria` and `execution_no_boundary` can fire on the same prompt because their verb sets intersect (`implement`, `build`). This is correct behaviour: a prompt asking to "build" something needs both criteria and a boundary.

5. **No override functionality** — By design (per HAS-007 scope). A future task could add a `--force` flag for expert operators who have a deliberate reason to submit an unconventional prompt.

---

## Recommended Next Task: HAS-008

With HAS-006 (output enforcer) and HAS-007 (input linter) in place, the HAS quality pipeline is significantly hardened. The natural next step is one of:

**HAS-008a — Freeze list / decision deduplication guard:** Prevent the same architectural scope from being re-opened after it has been `executed`. This closes the loop where an operator accidentally re-debates a settled decision.

**HAS-008b — Thread summary export:** After a thread reaches `resolved` status, auto-generate a `has-data/exports/thread-summary-[id].md` containing all decisions, their status, and a narrative summary. This gives the operator a portable record of a complete debate session.

The freeze list (HAS-008a) is the more defensive choice; the thread summary (HAS-008b) is the more useful operational artifact.
