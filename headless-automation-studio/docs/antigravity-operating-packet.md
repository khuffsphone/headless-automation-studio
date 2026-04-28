# Antigravity Operating Packet

> **Read this file before executing any HAS task.**
> Also read `has-data/freeze-list.json` before touching any protected path.

**Repo:** `headless-automation-studio`
**Last updated:** 2026-04-28
**Maintained by:** HAS operator

---

## A. Project State

| Task | Status | What it does |
|---|---|---|
| HAS-006 | ✅ Complete | Post-debate execution brief enforcer — validates 10 required sections before export |
| HAS-007 | ✅ Complete | Pre-debate input lint — blocks vague, multi-objective, boundary-free prompts before dispatch |
| HAS-008 | ✅ Complete | Freeze list — blocks unacknowledged changes to protected contracts at export |
| ARCHON-006A | 🔜 Next | Workshop Persistence — next product task after HAS hardening is complete |

### What HAS does

**Vague operator intent goes in. Bounded execution brief comes out.**

HAS exists to reduce wasted compute and agent drift. The three-model debate room converts an operator question into a structured decision. The export pipeline enforces that the resulting brief is specific enough for Antigravity or Claude Code to execute safely. The freeze list ensures that execution does not silently touch protected contracts.

### Current quality gate stack

```
Operator question
       │
  ┌────▼──────────────────────────┐
  │  HAS-007: questionLinter      │  ← blocks vague/multi-objective/boundary-free prompts (422)
  └────┬──────────────────────────┘
       │ valid only
  Three-model debate room
       │ synthesis → operator accepts proposal
  ┌────▼──────────────────────────┐
  │  HAS-006: briefEnforcer       │  ← blocks incomplete execution briefs at export (422)
  └────┬──────────────────────────┘
       │ normalized brief
  ┌────▼──────────────────────────┐
  │  HAS-008: freezeList          │  ← blocks unacknowledged protected contract changes (422)
  └────┬──────────────────────────┘
       │ cleared
  Antigravity / Claude Code execution
```

### Protected contracts (freeze list)

See `has-data/freeze-list.json` for the current list. At time of writing:

| ID | Protected paths | Acknowledgment required |
|---|---|---|
| `archon-game-consumer-contract` | `archon-game/src/contracts/**`, `archon-game/docs/mcp-phase2-design.md` | Yes |
| `workshop-export-contract` | `archon-workshop/**/export*`, `archon-workshop/**/manifest*` | Yes |
| `has-decision-schema` | `src/types/schema.ts` | Yes |

To override, the accepted proposal or `operator_rationale` must contain an explicit phrase that directly names the item, e.g.:
`"freeze-list override approved for has-decision-schema"`

A generic phrase (`"freeze-list override approved"`) or a phrase naming a different item does **not** satisfy the check.

---

## B. Non-Negotiable Agent Rules

These rules apply to every HAS task regardless of scope.

### 1. Inspect before writing

Read all relevant files before modifying anything. Return findings before proposing changes. Do not infer file contents from memory.

### 2. Wait for confirmation after execution-gate plan

After returning an inspection summary and implementation plan, **stop**. Do not write code, create files, or run mutating commands until the operator explicitly confirms.

### 3. Keep scope bounded

Execute only what is in the confirmed plan. If you discover work that was not in scope, stop and report it. Do not expand scope unilaterally.

### 4. Do not add integrations unless explicitly scoped

Do not add:
- Deep Researcher
- Anthropic Sessions API
- Chrome Agent automation
- GitHub automation
- Background workers
- New agents or orchestration layers
- New UI components outside the confirmed scope

If an integration seems beneficial, report it. Do not implement it.

### 5. Do not mutate historical decision data unless explicitly scoped

`has-data/decisions.json` is an append-only record. Do not delete, overwrite, or reorder existing records. `updateDecisionStatus` is the only sanctioned in-place mutation, and only for advancing `execution_status` through the defined lifecycle.

### 6. Do not rely on undeclared transitive dependencies

Do not import packages that are not in `package.json` `dependencies` or `devDependencies`, even if they are reachable through `node_modules` as transitive dependencies. If a package is needed, state the requirement explicitly and wait for approval before running `npm install`.

### 7. Validate before writing output files

Run `enforceExecutionBrief` and `checkProposalAgainstFreezeList` before writing any export file. Do not write partial files and then validate. Validation must pass before the file is created.

### 8. Do not modify protected contracts without explicit freeze-list acknowledgment

Before any change to a path covered by `has-data/freeze-list.json`, the accepted proposal or `operator_rationale` must contain a valid acknowledgment phrase that directly names the protected item's id or label. See Section A for acknowledgment format.

---

## C. Test Discipline

> ### ⚠️ Primary Rule
>
> **If a test exposes a logic defect, fix the logic.**
>
> Do not weaken, move, delete, or reinterpret the test unless the operator explicitly approves that the test itself is invalid.
>
> This rule has no exceptions without operator sign-off.

### Background: why this rule exists

During HAS-008 implementation, a smoke test correctly identified that the acknowledgment logic was flawed: an override phrase targeting `workshop-export-contract` was incorrectly satisfying the check for `has-decision-schema` because both appeared within a 200-character proximity window.

The initial response was to move the items further apart in the test to make the proximity check pass. This was the wrong fix — it weakened the test to accommodate a defective implementation. The correct fix (replacing proximity-based matching with compound regex patterns that structurally bind the override phrase to the specific item) was applied afterward.

**The lesson:** A failing test is evidence about the implementation, not the test.

### Additional test rules

- **Add regression coverage** for every bug found during implementation. If a defect is caught and fixed, add a test case that would have caught it.
- **Do not change smoke tests to make code pass.** If the smoke test fails, the implementation is wrong until proven otherwise.
- **If a test seems wrong, stop and explain why** before changing it. Get operator approval before modifying any smoke test assertion.
- **Never delete a test case** without operator approval and an explicit reason.
- **Test prompts must reflect reality.** Do not craft test inputs that avoid the failure mode being tested. The test input should be the most natural trigger for the rule being verified.

---

## D. Known Agent Failure Patterns

### 1. Scope expansion

**Symptom:** The implementation adds features, files, or integrations that were not in the confirmed plan. The agent justifies this as "while I was in there" or "this seemed related."

**Countermeasure:** Before writing any file, verify it appears in the confirmed plan. If it does not, stop and ask. Write the smallest change that satisfies the confirmed scope.

---

### 2. Test weakening

**Symptom:** A smoke test fails. Instead of fixing the implementation, the agent modifies the test prompt, increases a distance threshold, removes an assertion, or reframes the test as "testing the wrong thing."

**Countermeasure:** Treat a failing test as a defect report against the implementation. Fix the logic. If the test is genuinely invalid (wrong expected behaviour), stop and explain the argument to the operator before changing it. Do not change tests to make code pass.

---

### 3. Transitive dependency use

**Symptom:** The implementation imports a package (e.g. `minimatch`, `lodash`, `uuid`) that is not in `package.json` but happens to be reachable in `node_modules` because another package depends on it.

**Countermeasure:** Before importing any package, check `package.json`. If the package is not listed, do not import it. Propose adding it explicitly and wait for approval. Use local helpers instead where feasible (see `globToRegex` in `src/lib/freezeList.ts` as an example).

---

### 4. Historical data mutation

**Symptom:** The agent deletes, overwrites, or reorders records in `has-data/decisions.json`, `has-data/messages.json`, or `has-data/threads.json` as part of a task that did not explicitly require it.

**Countermeasure:** Treat all HAS data files as append-only unless the task explicitly involves data migration. Use `updateDecisionStatus` for status transitions. Never write to a data file without verifying it is within scope.

---

### 5. Partial file writes before validation

**Symptom:** The agent creates an export file and then runs validation. If validation fails, a partial or invalid file exists on disk.

**Countermeasure:** Always validate in memory first. Write to disk only after all checks pass. In `writeAgBridgeFile`, the order is: brief enforcer → freeze list → `fs.writeFileSync`. No file is written on any gate failure.

---

### 6. Vague completion

**Symptom:** The agent reports "done" or "complete" without providing exact file paths, command output, commit hashes, or test results. The operator cannot verify what was actually done.

**Countermeasure:** Always return the full closeout checklist (Section G). Include exact output, not summaries. Do not say "tests passed" — show the pass count and any notable output.

---

### 7. False confirmation

**Symptom:** The agent reports that a build, typecheck, or smoke test passed when it did not, either due to not running the command or misreading the output.

**Countermeasure:** Run each verification command explicitly and include its full output or exit code in the closeout. If a command cannot be run (e.g. server is not started), say so clearly rather than skipping the verification step.

---

### 8. Overbuilding orchestration instead of completing the current task

**Symptom:** The agent adds abstractions, registries, plugin systems, manager classes, or multi-step pipelines that were not asked for, often framed as "future-proofing."

**Countermeasure:** Build the smallest implementation that satisfies the confirmed scope. Future extensibility is a legitimate concern — raise it in the closeout as a recommendation, not as unilateral implementation.

---

## E. Command Boundaries

### Allowed without approval

These commands are safe to run as part of normal task execution:

```powershell
npx tsc --noEmit                                               # type check
npm run build                                                  # production build
node --experimental-strip-types scripts/smoke-test-*.mjs      # smoke tests
git status                                                     # working tree status
git diff                                                       # diff unstaged
git diff --stat                                                # diff summary
git add <specific files>                                       # stage specific files only
git commit -m "<message>"                                      # commit staged files
git push origin main                                           # push to main
git log --oneline -<n>                                         # recent commits
git show <hash> --stat                                         # inspect commit
```

### Requires explicit operator approval

Do not run any of these without asking first:

```powershell
npm install <package>             # adds a dependency
npm uninstall <package>           # removes a dependency
# any change to package.json or package-lock.json
# any change to tsconfig.json or next.config.*

git reset --hard                  # destructive — discards local changes
git clean -fd                     # destructive — removes untracked files
git rebase                        # history rewriting
git cherry-pick                   # history manipulation

Remove-Item -Recurse              # recursive delete
rm -rf                            # recursive delete (Unix-style)
# moving or renaming directories

# any command run outside the repo root
# any command that touches archon-game or archon-workshop
```

---

## F. Standard Execution Sequence

Every HAS task follows this sequence. Do not skip steps.

| Step | Action | Gate |
|---|---|---|
| 1 | **Inspect** relevant files, data structures, and recent commits | No writes |
| 2 | **Return execution-gate plan** — files to change, approach, commands, risks | No writes |
| 3 | **Wait for confirmation** — do not proceed until operator explicitly approves | Hard stop |
| 4 | **Implement** the smallest viable change that satisfies the confirmed scope | Scoped writes |
| 5 | **Run verification** — `npx tsc --noEmit`, `npm run build`, smoke tests if applicable | Fix failures before continuing |
| 6 | **Write walkthrough artifact** — `docs/walkthrough-has-NNN.md` | After verification passes |
| 7 | **Stage scoped files** — `git add` only the files changed by this task | No stray files |
| 8 | **Commit and push** | After walkthrough is written |
| 9 | **Return closeout summary** — full checklist per Section G | Final step |

---

## G. Standard Closeout Checklist

Return all of the following at task completion. Do not omit items.

```
Files changed:
  <list each file with NEW / MODIFIED / DELETED>

Commands run:
  <exact command and output or exit code for each>

Typecheck result:
  npx tsc --noEmit → <0 errors / N errors>

Build result:
  npm run build → <exit code, route summary>

Smoke test result (if applicable):
  node --experimental-strip-types scripts/smoke-test-has-NNN.mjs
  → <N passed, 0 failed>

Walkthrough:
  docs/walkthrough-has-NNN.md

Known limitations:
  <list any known edge cases, gaps, or follow-up items>

Commit hash:
  <short hash> — <commit message>

Pushed:
  yes / no — <branch>
```

---

## H. Reusable Prompt Header for Future AG Tasks

Copy this block verbatim into future task prompts before describing the task:

---

```
Read first:
- docs/antigravity-operating-packet.md
- has-data/freeze-list.json

Operate in Planning mode.

Inspect before writing.
Return an execution-gate plan.
Wait for confirmation.

If a smoke test fails, assume implementation is wrong before assuming the test is wrong.

Do not change tests to make code pass unless explicitly approved.

Do not add agents, API bridges, background workers, orchestration, or integrations unless explicitly scoped.
```

---

## Appendix: HAS Walkthrough Index

| Task | File | Commit |
|---|---|---|
| HAS-006 | `docs/walkthrough-has-006.md` | `00a771a` / `ed5eb29` |
| HAS-007 | `docs/walkthrough-has-007.md` | `5861ccc` |
| HAS-008 | `docs/walkthrough-has-008.md` | `bbeec49` / `0cc4c19` / `f951639` |

## Appendix: Known Open Items

| Item | File | Description |
|---|---|---|
| Stale JSDoc in `freezeList.ts` | `src/lib/freezeList.ts` lines ~297–300 | `checkProposalAgainstFreezeList` JSDoc still references "within 200 chars" — describes the old proximity logic, not the current compound-regex implementation. Out of scope for HAS-009 (code file). Fix in a future maintenance pass. |
