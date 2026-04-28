# Walkthrough — HAS-008: Freeze List for Protected Contracts

**Commit:** TBD (recorded after push)
**Repo:** `headless-automation-studio`
**Date:** 2026-04-28
**Status:** Complete

---

## Files Changed

| File | Action | Purpose |
|---|---|---|
| `has-data/freeze-list.json` | **NEW** | Canonical config — 3 starter protected items |
| `src/lib/freezeList.ts` | **NEW** | Loader, checker, section builder; all types and error classes |
| `src/lib/storage.ts` | **MODIFIED** | Imports freeze list, re-exports error classes, wires check into `writeAgBridgeFile`, injects section into export markdown |
| `src/app/api/decision/[id]/export/route.ts` | **MODIFIED** | Catches `FreezeListConfigError` and `FreezeListError` → 422 |
| `src/components/DecisionLog.tsx` | **MODIFIED** | Renders freeze-list hits and config errors inline |
| `scripts/smoke-test-has-008.mjs` | **NEW** | 35-assertion smoke test |
| `docs/walkthrough-has-008.md` | **NEW** | This document |

**Not modified:** `src/types/schema.ts` (all freeze-list types live in `freezeList.ts`)

---

## HAS Quality Gate Stack (after HAS-008)

```
Operator question
       │
  ┌────▼──────────────────────────┐
  │  HAS-007: questionLinter      │  ← blocks vague/multi-objective/boundary-free prompts
  └────┬──────────────────────────┘
       │ valid only
  Three-model debate room
       │ synthesis
  ┌────▼──────────────────────────┐
  │  HAS-006: briefEnforcer       │  ← blocks vague/incomplete execution briefs at export
  └────┬──────────────────────────┘
       │ normalized brief
  ┌────▼──────────────────────────┐
  │  HAS-008: freezeList          │  ← blocks unacknowledged protected contract changes
  └────┬──────────────────────────┘
       │ cleared
  Antigravity execution
```

---

## How the Freeze List Works

### Config: `has-data/freeze-list.json`

Three starter protected items:

| ID | Type | Patterns |
|---|---|---|
| `archon-game-consumer-contract` | path | `archon-game/src/contracts/**`, `archon-game/docs/mcp-phase2-design.md` |
| `workshop-export-contract` | path | `archon-workshop/**/export*`, `archon-workshop/**/manifest*` |
| `has-decision-schema` | path | `src/types/schema.ts` |

All three have `requires_explicit_acknowledgment: true`.

### `src/lib/freezeList.ts`

**No external dependencies.** Provides:
- `FreezeListItem`, `FreezeList`, `FreezeListHit` types
- `FreezeListConfigError` — thrown on malformed JSON, surfaces as 422
- `FreezeListError` — thrown on unacknowledged blocking hits, surfaces as 422
- `globToRegex(pattern)` — local glob-to-regex helper (`**` → `.*`, `*` → `[^/]*`, `?` → `[^/]`)
- `loadFreezeList()` — returns `null` if file missing (non-fatal), throws `FreezeListConfigError` if malformed
- `checkProposalAgainstFreezeList(proposal, rationale, freezeList)` — matches proposal text against all items
- `buildFreezeListSection(freezeList, hits)` — builds the markdown section for every export

### Pattern matching (text-based)

Because the proposal is **free text** (not a filesystem path), matching works in three layers:

1. **Item id** — word-boundary regex match: `\bhas-decision-schema\b`
2. **Item label** — case-insensitive substring: `"HAS decision schema"` anywhere in the text
3. **Literal pattern segments** — non-wildcard parts of each glob pattern, ≥4 chars: `archon-game/src/contracts`, `archon-workshop`, etc.

### Acknowledgment check

A valid acknowledgment requires an explicit phrase that **directly names** the specific item id or label. The item name must appear **as part of** the override phrase — not just nearby.

`buildAcknowledgmentPatterns(item)` generates 6 compound regexes per item:

| Pattern | Example (for `has-decision-schema`) |
|---|---|
| `freeze-list override approved for <item>` | `"freeze-list override approved for has-decision-schema"` |
| `protected contract change approved for <item>` | `"protected contract change approved for HAS decision schema"` |
| `explicit freeze-list acknowledgment: <item>` | `"explicit freeze-list acknowledgment: has-decision-schema"` |
| `freeze-list acknowledged for <item>` | `"freeze-list acknowledged for has-decision-schema"` |
| `override approved for <item>` | `"override approved for has-decision-schema"` |
| `<item>: freeze-list override` | `"has-decision-schema: freeze-list override"` |

**Invalid — these do NOT acknowledge `has-decision-schema`:**
- `"freeze-list override approved for workshop-export-contract"` — wrong item named
- `"has-decision-schema"` alone — no override language
- `"freeze-list override approved"` with no item name — no binding
- item id appearing near (but not inside) an override phrase for a different item

### Gate order in `writeAgBridgeFile`

```
1. assertWithinStorage()
2. briefEnforcer (HAS-006) — 422 brief_enforcement_failed if fails
3. loadFreezeList() — null = non-fatal; FreezeListConfigError if malformed
4. checkProposalAgainstFreezeList() — FreezeListError if blocking unacknowledged hits
5. fs.mkdirSync / fs.writeFileSync — only reached if all gates pass
6. buildFreezeListSection() — always injected into the export markdown
```

---

## Export Markdown: Freeze-List Section

Every successful export now contains a `## 🔒 Protected Contracts — Freeze List` section. Example when no items are referenced:

```markdown
## 🔒 Protected Contracts — Freeze List

Freeze list v1 — 3 protected items registered.

| ID | Label | Referenced | Acknowledged |
|---|---|---|---|
| `archon-game-consumer-contract` | Archon game consumer contract | ✅ No | — |
| `workshop-export-contract` | Workshop export contract | ✅ No | — |
| `has-decision-schema` | HAS decision schema | ✅ No | — |

> No protected items were referenced in this proposal.
> All protected contracts are clear.
```

Example when an item is referenced and acknowledged:

```markdown
| `has-decision-schema` | HAS decision schema | ⚠️ Yes (id "has-decision-schema") | ✅ Yes |

### Referenced protected items

**has-decision-schema** — HAS decision schema
- Matched on: id "has-decision-schema"
- Protected because: Decision schema changes can invalidate stored local decisions.
- Acknowledgment required: yes
- Acknowledged: yes
```

---

## How the Acknowledgment Override Works

The operator does not need a new UI field. They write explicit acknowledgment language in the **`operator_rationale`** field when saving a decision:

```
freeze-list override approved for has-decision-schema.
The schema change adds an optional `tags` field. Existing records are unaffected
because JSON deserialization ignores unknown fields.
```

Or in the **accepted proposal** itself:

```
explicit freeze-list acknowledgment: has-decision-schema
This task modifies src/types/schema.ts to add an optional field.
```

---

## Commands Run

```powershell
npx tsc --noEmit                                                   # 0 errors
npm run build                                                       # ✓ clean
node --experimental-strip-types scripts/smoke-test-has-008.mjs     # 35/35
```

---

## Smoke Test Results (35/35)

```
Test 1:   Reference by id → blocked                             ✅ 3 assertions
Test 2:   Reference by label → blocked                          ✅ 2 assertions
Test 3:   Reference by pattern segment → blocked                ✅ 2 assertions
Test 4:   Override names wrong item → still blocked             ✅ 3 assertions
Test 4b:  Direct override for correct item → ok, acknowledged   ✅ 2 assertions
Test 4c:  Generic override (no item binding) → blocked          ✅ 3 assertions
Test 5:   Valid acknowledgment in proposal → ok                 ✅ 3 assertions
Test 6:   Valid acknowledgment in rationale → ok                ✅ 2 assertions
Test 7:   No frozen references → ok, empty hits                 ✅ 2 assertions
Test 8:   Missing freeze-list.json → null (non-fatal)           ✅ 1 assertion
Test 9:   Malformed JSON → FreezeListConfigError                ✅ 3 assertions
Test 10:  globToRegex pattern conversion                        ✅ 4 assertions
Test 11:  API 422 on non-compliant eligible decision            ✅ 1 assertion
Test 12:  No file written on API failure                        ✅ 1 assertion
Test 13:  Already-executed → 422 not_eligible                   ✅ 2 assertions
                                               Total:           35 passed, 0 failed
```

---

## Known Limitations

1. **Text-based matching, not AST/path matching** — The checker scans free-text proposals, not actual file paths. A proposal that describes a change without naming the path or id may not be caught. Operators should use the protected item ids in their proposals.

2. **No freeze-list entry points in the UI** — Operators must edit `has-data/freeze-list.json` directly to add new protected items. A future HAS task could add a management UI.

3. **One config path** — `loadFreezeList()` uses `process.cwd()` to resolve the path. In non-standard working directory contexts the path may differ. The same pattern is used throughout `storage.ts` so this is consistent.

4. **No test for `freeze_list_blocked` API path with a fully compliant decision** — The smoke test uses direct function calls to cover the blocking logic. Testing the full API path would require a brief-enforcer-passing eligible decision, which none of the current decisions satisfy.

---

## Adding New Protected Items

Edit `has-data/freeze-list.json` and add to `protected_items`:

```json
{
  "id": "my-protected-contract",
  "label": "My protected contract",
  "type": "contract",
  "patterns": ["src/lib/myModule.ts"],
  "reason": "Breaking changes here require explicit review.",
  "requires_explicit_acknowledgment": true
}
```

The change takes effect on the next export attempt — no restart required.
