# GitHub Webhook Setup

GitHub webhooks deliver real-time events to your n8n instance whenever activity happens in the repo. This document explains how to configure the webhook correctly.

---

## Prerequisites

- n8n is running and reachable at a **public HTTPS endpoint** (not localhost — GitHub cannot reach your local machine directly)
- You have admin access to the GitHub repository

See `docs/setup/local-setup-checklist.md` for tunnel setup options.

---

## Configuration Steps

### 1. Navigate to Webhook Settings
- Go to your GitHub repository
- Click **Settings** → **Webhooks** → **Add webhook**

### 2. Set the Payload URL

Use the following format, substituting your actual public endpoint:

```
https://<YOUR-PUBLIC-ENDPOINT>/webhook/github
```

> If using ngrok: `https://<YOUR-NGROK-SUBDOMAIN>.ngrok.io/webhook/github`  
> If using Cloudflare Tunnel: `https://<YOUR-CF-SUBDOMAIN>.<YOUR-DOMAIN>/webhook/github`  
> If n8n is hosted: `https://<YOUR-N8N-HOST>/webhook/github`

The `/webhook/github` path must match the path configured in the n8n webhook trigger node inside `github-router.workflow.json`.

### 3. Set Content Type

Select: **`application/json`**

Do not use `application/x-www-form-urlencoded`.

### 4. Set a Secret *(Recommended)*

Generate a random secret string and paste it into the "Secret" field. Store it in your local environment:

```
GITHUB_WEBHOOK_SECRET=<your-secret>
```

Configure the same secret inside the n8n webhook node for signature verification.

### 5. Select Events

Choose **"Let me select individual events"** and enable the following:

- [x] **Issues** — captures `labeled`, `opened`, `closed` events on issues
- [x] **Pull requests** — captures `opened`, `labeled`, `synchronize`, `closed` events on PRs
- [x] **Issue comments** — captures new comments on issues and PRs
- [x] **Pull request review comments** — captures inline review comments
- [x] **Labels** — captures label creation/deletion events

Deselect everything else to reduce noise.

### 6. Activate

Ensure **Active** is checked. Click **Add webhook**.

### 7. Verify Delivery

After saving, GitHub will send a `ping` event. Check:
- GitHub: Webhooks → Recent Deliveries → look for `ping` with a `200` response
- n8n: Executions panel → the GitHub Router workflow should show a triggered execution

---

## Troubleshooting

| Issue | Likely Cause |
|---|---|
| GitHub shows `failed to connect` | Tunnel is not running or URL is wrong |
| n8n shows no execution | Webhook path mismatch — check the n8n node's path setting |
| `401 Unauthorized` from n8n | Webhook secret mismatch |
| Events not triggering | Wrong event types selected in GitHub webhook settings |
| `200` but n8n does nothing | Router node condition doesn't match the event shape |
