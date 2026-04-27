# Headless Automation Studio v0.1 — Phase One Build

This bundle contains the complete source for Phase One of Layer One, faithful
to the Layer One Technical Design Document, Revision 2 and the revised
Phase One Implementation Brief.

**What this is:** dummy responses, real persistence, real decision-capture
gating. Three model panes display hardcoded stub responses after a 1.5 second
simulated latency. Accepted decisions are captured to `has-data/decisions.json`
and `has-data/exports/decisions.md` only after the mandatory five-prompt
quality checklist is complete.

**What this is not:** there are no real provider API calls, no SDKs, no
streaming, no auth, no external integrations. Those are Phase Two work.

---

## Bootstrap

The Next.js project itself is not included in this bundle, because it
depends on `npx create-next-app` which requires network access. Run that
command yourself, then drop the contents of this bundle on top of the
generated project.

### 1. Generate the Next.js scaffold

In an empty parent directory, run:

```bash
npx create-next-app@latest headless-automation-studio \
  --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
```

Accept the defaults for any prompts not covered by the flags.

### 2. Drop this bundle on top

Copy every file in this bundle into the generated `headless-automation-studio/`
directory, **overwriting** any files that already exist (notably
`src/app/page.tsx`, `src/app/layout.tsx`, and `src/app/globals.css`).

### 3. Install runtime dependencies

```bash
cd headless-automation-studio
npm install react-markdown
```

### 4. Verify the storage layout

The bundle ships pre-initialized `has-data/` files. After copying, you should
have:

```
has-data/
├── project_context.json   # scaffolded with empty-but-present fields
├── messages.json          # []
├── decisions.json         # []
├── threads.json           # one default "Initial Validation Thread"
└── exports/
    └── decisions.md       # placeholder until first Save Decision
```

### 5. Run the dev server

```bash
npm run dev
```

Open http://localhost:3000.

---

## Smoke test

The first run should exercise the full Phase One loop:

1. Type a question into the operator input. Dispatch.
2. After ~1.5 s, three panes populate with hardcoded specialization-aware
   stub responses, each carrying a handoff note.
3. Click **Copy to Synthesis** on one pane to populate the synthesis area.
4. Edit the proposal text if you want, set the source, fill in scope,
   rationale, dependencies, constraints, open questions.
5. Answer **all five** prompts in the quality checklist. The Save Decision
   button stays disabled until every prompt is answered.
6. Save Decision. The decision appears in the Decision Log section, and
   `has-data/decisions.json` and `has-data/exports/decisions.md` update on
   disk.
7. Restart the dev server. State on disk persists; the UI rehydrates from
   `/api/ask` and `/api/decision`.

If any of those steps fails, treat it as a Phase One bug rather than a
schema or design issue — the schemas were verified against the design
document during this build.

---

## File map

```
src/
├── app/
│   ├── api/
│   │   ├── ask/route.ts          POST: persists operator question, then
│   │   │                          three dummy responses after 1.5 s.
│   │   └── decision/route.ts     POST: validates and persists a Decision,
│   │                              regenerates exports/decisions.md.
│   ├── globals.css               Tailwind imports + minimal prose tweaks.
│   ├── layout.tsx                Root layout.
│   └── page.tsx                  Operator surface composing all components.
├── components/
│   ├── DecisionLog.tsx           Renders captured decisions inline.
│   ├── ModelPane.tsx             One pane per model. Renders markdown,
│   │                              handoff_note, and provider_failure cards.
│   ├── OperatorInput.tsx         Question composition area.
│   ├── QualityChecklist.tsx      Mandatory five-prompt gate.
│   ├── SynthesisArea.tsx         Decision capture workspace + checklist.
│   └── ThreadHistory.tsx         Full message log view.
├── lib/
│   ├── dummy-responses.ts        Hardcoded stub responses for each role.
│   └── storage.ts                Single source of fs I/O + boundary check.
└── types/
    └── schema.ts                 Message, Decision, ProjectContext, Thread.

has-data/                          Storage boundary. Nothing else may
                                   read or write outside this directory.
```

---

## Known Phase One characteristics (not bugs)

- All three model responses arrive together after 1.5 s rather than
  streaming or arriving at independently variable latencies. This is
  deliberate. Phase Two will replace the simulated delay with parallel
  real provider calls.
- The `provider_failure` rendering paths are present in `ModelPane` and
  `ThreadHistory` but are not exercised by Phase One because nothing can
  fail. They will start producing visible output in Phase Two.
- Rejected alternatives are derived automatically from the candidate
  responses that were not selected as the source. The operator cannot
  edit rejected alternatives explicitly in v0.1; this is by design,
  to keep the form surface bounded.
- File I/O is synchronous. If `messages.json` grows large enough to
  produce noticeable UI blocking, switch to async I/O with file locks.
- The `downstream_task_ready` field is a boolean. A future migration to
  an enumerated type is anticipated and noted in `schema.ts`.

---

## Recommended first captured decision

Per the consolidated review trail, the first decision captured during
self-bootstrapping validation should be the framework choice itself:
"Use Next.js (App Router) + TypeScript + Tailwind CSS for Phase One,
with synchronous fs I/O confined to ./has-data/." Saving this as the
first entry exercises the full capture flow end to end and produces an
audit-ready record of the decision that already shaped this build.

---

## Where to look when things drift

- Schema reductions → `src/types/schema.ts` is authoritative.
- Optional checklist → it is mandatory; see `src/components/SynthesisArea.tsx`
  and `src/app/api/decision/route.ts` validation.
- Writes outside `has-data/` → `src/lib/storage.ts` enforces the boundary
  via `assertWithinStorage` on every read and write.
