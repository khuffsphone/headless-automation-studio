# Local Setup Checklist

Complete this checklist before running the workflow for the first time. Items must be done in order — later steps depend on earlier ones.

---

## Infrastructure

- [ ] **Docker installed and running**
  - Verify: `docker info` returns no errors
  - Required for running n8n locally

- [ ] **n8n running on `localhost:5678`**
  - Start via Docker: `docker run -it --rm -p 5678:5678 -v ~/.n8n:/home/node/.n8n n8nio/n8n`
  - Or via npm: `npx n8n`
  - Verify: Open `http://localhost:5678` in browser — n8n UI loads

- [ ] **Local tunnel or public endpoint configured** *(required for GitHub webhooks)*
  - Option A: [ngrok](https://ngrok.com/) — `ngrok http 5678` → copy the HTTPS forwarding URL
  - Option B: [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
  - Option C: Deploy n8n to a hosted environment
  - Record your public endpoint URL — you'll need it for the webhook setup

---

## GitHub Repository

- [ ] **GitHub repository created**
  - Repo name and org/user match whatever you plan to use as `{{ORG/REPO}}` in payloads
  - Visibility: Private or Public depending on your preference

- [ ] **All required labels created in the repo**
  - Use the GitHub UI: Repo → Labels → New Label
  - Or use the GitHub CLI: `gh label create <name> --color <hex> --description "<desc>"`
  - Reference: `config/labels.json` for names, colors, and descriptions
  - Required labels: `build:codex`, `build:cursor`, `review:ag`, `qa:jules`, `status:ready`, `status:blocked`, `status:needs-human`

- [ ] **Webhook endpoint added to repo settings**
  - See `docs/setup/github-webhook-setup.md` for full instructions
  - Placeholder: `https://<YOUR-TUNNEL-URL>/webhook/github`

- [ ] **Issue templates visible in GitHub**
  - Create a test issue — the "Task" template should appear as an option

---

## Agent Credentials

- [ ] **Jules API key obtained and stored locally**
  - See `docs/setup/jules-api-setup.md`
  - Store as environment variable: `JULES_API_KEY=<your-key>`
  - **Do not commit real keys to this repo**

- [ ] **n8n credentials configured** *(in n8n UI, not in code)*
  - GitHub API token: Personal Access Token with `repo` and `webhook` scopes
  - Jules API key: HTTP Header credential in n8n

---

## Workflow Import

- [ ] **n8n workflow JSON files imported**
  - In n8n UI: Workflows → Import from file
  - Import `n8n/workflows/github-router.workflow.json`
  - Import `n8n/workflows/pr-to-jules.workflow.json`
  - Update placeholder credential IDs and webhook URLs in the UI after import

---

## Dry Run Validation

- [ ] **Run the scaffold validator**
  - PowerShell: `.\scripts\bootstrap\validate-agent-scaffold.ps1`
  - Bash: `./scripts/bootstrap/validate-agent-scaffold.sh`
  - All items should show `PASS`

- [ ] **Create a test GitHub Issue using the Task template**
  - Fill in a minimal objective and scope
  - Apply the `build:codex` label
  - Verify n8n receives and logs the webhook event (check n8n Executions panel)

- [ ] **Manually trigger a test Antigravity review**
  - Open a draft PR on any branch
  - Apply the `review:ag` label
  - Confirm n8n routes the event correctly

- [ ] **Dry run Jules dispatch** *(requires Jules API key)*
  - Apply `qa:jules` to the test PR
  - Confirm n8n posts a Jules session creation request (or logs it in test mode)
