# Agent Status Comment Format

Agents post structured status updates as PR comments using a machine-readable YAML block wrapped in an HTML comment tag. This allows n8n and other tooling to parse agent state without polluting the visible PR timeline — the block is hidden in the rendered GitHub UI but accessible via the API.

## Block Format

```
<!-- agent-status -->
agent: codex
task_id: ISSUE-123
status: running
branch: feat/ISSUE-123-short-name
summary: Implementing requested feature and adding tests
next_action: open_pr
artifacts:
  - issue_url: https://github.com/ORG/REPO/issues/123
  - pr_url:
```

> The block must start with the exact comment tag `<!-- agent-status -->` on its own line. Parsers match this sentinel and read the YAML body that follows until the next blank line or end of comment.

---

## Allowed Field Values

### `agent`

Identifies which agent posted the status update.

| Value | Description |
|---|---|
| `codex` | OpenAI Codex builder agent |
| `cursor` | Cursor IDE agent session |
| `antigravity` | Antigravity scrutinizer / reviewer |
| `jules` | Jules async QA finisher |
| `n8n` | n8n router (system-level status) |

---

### `status`

The current execution state of the agent.

| Value | Description |
|---|---|
| `pending` | Agent has received the task but has not started work |
| `running` | Agent is actively working |
| `waiting` | Agent has paused and is waiting for an external event or human input |
| `complete` | Agent has finished successfully |
| `failed` | Agent encountered an unrecoverable error |
| `blocked` | Agent cannot proceed due to a dependency or constraint |

---

### `next_action`

The expected next event or action after the current status.

| Value | Description |
|---|---|
| `open_pr` | Agent will open a Pull Request |
| `post_findings` | Antigravity will post a findings comment |
| `apply_label` | n8n or agent will apply a routing label |
| `dispatch_jules` | n8n will dispatch a Jules QA session |
| `await_human` | No automation — a human must act |
| `merge` | PR is ready; awaiting human merge decision |
| `none` | No further automated action expected |

---

## Parsing Notes

- Parsers should be lenient about trailing whitespace and blank `pr_url` values.
- The `artifacts` block is a YAML list of single-key objects. Additional artifact keys may be added without breaking existing parsers.
- If `status` is `failed` or `blocked`, n8n should suppress further dispatch and alert the operator.
- Each agent pass should post a **new** status comment rather than editing a prior one, to preserve the audit trail.
