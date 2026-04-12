# Jules API Setup

Jules is an async AI agent (by Google) that accepts a repository, branch, and prompt, then autonomously performs work and commits results. This document describes how to configure the Jules API integration.

---

## ⚠️ Credential Security

**Never commit real API keys to this repository.**

All secrets must be stored in local environment variables or in n8n's encrypted credential store. The `.env` file (if used) must be listed in `.gitignore`.

---

## Environment Variable

The Jules API key must be available as:

```
JULES_API_KEY=<your-jules-api-key>
```

**Where to set it:**

- **n8n (recommended):** Add a new "Header Auth" credential in n8n UI → name it `Jules-API-Key` → set header name `Authorization` and value `Bearer <your-key>`. Reference this credential in the HTTP Request nodes inside `pr-to-jules.workflow.json`.

- **Local shell:** Add to your shell profile (`~/.bashrc`, `~/.zshrc`, PowerShell profile) or pass inline when running scripts:
  ```
  $env:JULES_API_KEY = "your-key-here"
  ```

- **`.env` file:** If used, create a `.env` at the repo root and ensure `.gitignore` contains `.env`:
  ```
  JULES_API_KEY=your-key-here
  ```

---

## Obtain a Jules API Key

Jules API access is currently managed by Google. To obtain a key:
1. Visit the Jules product page or developer portal *(URL: placeholder — update when available)*
2. Request API access or retrieve your key from the developer dashboard
3. Store the key as described above

---

## API Endpoints (Placeholders)

These endpoint paths are placeholders. Update them with the actual Jules API base URL and paths from your Jules API documentation or dashboard.

### Session Creation (POST)

Used to dispatch a new Jules task session:

```
POST https://<JULES-API-BASE-URL>/sessions
Content-Type: application/json
Authorization: Bearer {{JULES_API_KEY}}

{
  "repo": "{{repo}}",
  "branch": "{{branch}}",
  "prompt": "{{prompt_content}}"
}
```

> In n8n, this is the "Create Jules Session" HTTP Request node in `pr-to-jules.workflow.json`. Replace `<JULES-API-BASE-URL>` with the actual base URL.

### Session Status Polling (GET)

Used to poll the status of a running Jules session:

```
GET https://<JULES-API-BASE-URL>/sessions/{{session_id}}
Authorization: Bearer {{JULES_API_KEY}}
```

> In n8n, this is the "Poll Jules Session" HTTP Request node. Wire the `session_id` from the creation response into this request.

---

## Integration Notes

- Jules sessions are **asynchronous**. After POST, poll the GET endpoint at a reasonable interval (e.g., every 30 seconds) until `status` is `complete` or `failed`.
- Jules commits directly to the specified branch. Ensure the branch exists before dispatching.
- If Jules fails or times out, n8n should apply the `status:blocked` label and alert the operator.
- Do not dispatch Jules to a branch that is already being processed by another agent.
