# n8n Workflow Files

This directory contains starter n8n workflow JSON files for the multi-agent GitHub orchestration system.

## Important: These Are Starter Placeholders

The JSON files in this directory are **template scaffolds**, not production-ready workflows. Before they will function correctly in n8n, each workflow requires manual adjustment in the n8n UI after import:

### Required Adjustments After Import

1. **Credential IDs** — n8n stores credentials with internal UUIDs. Any `credentials` blocks in the JSON contain placeholder references (`PLACEHOLDER_CREDENTIAL_ID`) that must be replaced with real credential IDs from your n8n instance.

2. **Webhook URLs** — The webhook trigger nodes use path placeholders. Verify that the webhook path matches what you've configured in your GitHub webhook settings (see `docs/setup/github-webhook-setup.md`).

3. **HTTP Request URLs** — Nodes that call external APIs (Jules, GitHub API) use placeholder base URLs. Update these with the actual endpoints from your environment.

4. **GitHub Token** — The GitHub API nodes require a Personal Access Token with `repo` scope, stored as an n8n HTTP Header Auth credential.

5. **Node-Specific Parameters** — Some nodes may require environment-specific values (org name, repo name, branch naming patterns). Review each node after import.

## Workflow Files

| File | Purpose |
|---|---|
| `github-router.workflow.json` | Receives all GitHub webhook events and routes them to the appropriate handler based on event type and label |
| `pr-to-jules.workflow.json` | Handles `qa:jules` label events — creates a Jules session, polls for completion, and posts results back to the PR |

## How to Import

1. Open your n8n instance
2. Go to **Workflows** → **Import from file** (or drag-and-drop)
3. Select the JSON file
4. Review and update all placeholder values before activating
5. Toggle the workflow to **Active** when ready

## Testing Without Live Credentials

Use the n8n **Manual Trigger** node to test workflow logic with sample payloads before connecting real credentials. You can also use n8n's built-in webhook test mode to inspect incoming payloads from GitHub.
