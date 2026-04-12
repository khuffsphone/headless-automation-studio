# GitHub Label Taxonomy

Labels are the primary routing signal in this workflow. They must be applied consistently because n8n watches for label events and dispatches agents based on exact label name matches.

## Label Definitions

### `build:codex`
**Purpose:** Assign this issue/PR to the Codex builder agent.  
**Applied by:** Human operator or issue automation at task start.  
**Routing effect:** n8n dispatches a Codex build session with the task payload.

---

### `build:cursor`
**Purpose:** Assign this issue/PR to the Cursor builder agent.  
**Applied by:** Human operator at task start.  
**Routing effect:** n8n dispatches a Cursor session (or notifies the operator that the branch is Cursor-assigned).

---

### `review:ag`
**Purpose:** Signal that a PR is ready for Antigravity adversarial review.  
**Applied by:** Builder agent (or human) when PR is opened and considered ready for scrutiny.  
**Routing effect:** n8n triggers Antigravity review flow, posting findings as a structured PR comment.

---

### `qa:jules`
**Purpose:** Signal that a PR is ready for Jules async QA / test hardening.  
**Applied by:** Human or Antigravity after the review comment is posted.  
**Routing effect:** n8n dispatches a Jules session with the branch, repo, and QA prompt.

---

### `status:ready`
**Purpose:** All automated checks and agent passes are complete. PR is ready for human merge decision.  
**Applied by:** Jules (or n8n) upon a successful QA pass.  
**Routing effect:** No further agent dispatch. Human reviews and merges.

---

### `status:blocked`
**Purpose:** Something is preventing forward progress — broken CI, merge conflict, missing information.  
**Applied by:** Any agent or human when a blocker is identified.  
**Routing effect:** n8n suppresses further agent dispatch until the label is removed.

---

### `status:needs-human`
**Purpose:** Automated agents have reached their boundary. A human decision or action is required.  
**Applied by:** Any agent that encounters ambiguity, risk, or out-of-scope scope creep.  
**Routing effect:** n8n suppresses automation and may post a Slack/notification alert (if configured).

---

## Routing Rules

The following table summarizes how n8n's router node maps label events to agent actions:

| Event | Label | Action |
|---|---|---|
| `issues.labeled` | `build:codex` | Dispatch Codex build session |
| `issues.labeled` | `build:cursor` | Notify operator (Cursor is human-initiated) |
| `pull_request.labeled` | `review:ag` | Trigger Antigravity review flow |
| `pull_request.labeled` | `qa:jules` | Dispatch Jules QA session |
| `pull_request.labeled` | `status:ready` | No dispatch — awaits human merge |
| `pull_request.labeled` | `status:blocked` | Suppress dispatch, alert operator |
| `pull_request.labeled` | `status:needs-human` | Suppress dispatch, alert operator |

> **Important:** Labels must match exactly (case-sensitive). Configure all labels in the repo before enabling automation. Use `config/labels.json` as the source of truth for label creation.
