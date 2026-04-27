# Headless Automation Studio — Phase Two Installation

This bundle upgrades your existing Phase One install with real provider API
calls to OpenAI (ChatGPT), Anthropic (Claude), and Google (Gemini).

## What changes

- `src/lib/providers.ts` is new. It contains the three provider integrations.
- `src/app/api/ask/route.ts` is replaced. Real API calls now happen here
  instead of the 1.5-second simulated delay and hardcoded dummy responses.
- `.env.local` is new. It holds your three API keys.

Nothing else changes. The schemas, the UI, the storage layer, the quality
checklist, and the decision capture flow are all untouched. Phase One
decisions you have already captured remain valid.

## Step-by-step install

You will run six commands in Command Prompt. Do them in this exact order.

### 1. Stop the dev server

In whichever Command Prompt window is running `npm run dev`, press
**Ctrl+C** to stop the server. Type `Y` if it asks whether to terminate.

### 2. Extract the Phase Two files over your existing project

Open a fresh Command Prompt window and run:

```
cd C:\Dev
tar -xf "%USERPROFILE%\Downloads\headless-automation-studio-phase2.zip"
```

This overlays the new files onto your existing project directory. It
overwrites `src/app/api/ask/route.ts` and adds `src/lib/providers.ts` and
`.env.local.template`.

### 3. Install the three provider SDKs

```
cd C:\Dev\headless-automation-studio
npm install openai @anthropic-ai/sdk @google/generative-ai
```

This downloads the official SDK for each provider. It will take 30 to 60
seconds.

### 4. Create your .env.local file

Copy the template to its real location:

```
copy .env.local.template .env.local
```

Then open `.env.local` in Notepad:

```
notepad .env.local
```

You will see three lines, each with a placeholder. Replace each
placeholder with your actual API key. Do not add quotes around the keys.
Each key goes on its own line. The file should look like this when done:

```
OPENAI_API_KEY=sk-proj-aBcD1234...
ANTHROPIC_API_KEY=sk-ant-api03-aBcD1234...
GOOGLE_API_KEY=AIzaSyA1B2C3D4...
```

Save the file (Ctrl+S) and close Notepad.

### 5. Start the dev server

```
npm run dev
```

Wait for "Ready" or a similar message. The server is now running with real
API calls enabled.

### 6. Run a live test

Open http://localhost:3000 in your browser. Pose a question that is
actually meaningful. Something like:

> What are the three biggest risks of using a multi-model decision room
> instead of a single-model assistant?

Click Dispatch. The three responses will arrive at different times this
run, because they are coming from three different provider APIs. ChatGPT
typically responds in 3 to 8 seconds. Gemini typically responds in 2 to 5
seconds. Claude typically responds in 4 to 10 seconds.

When all three have arrived, look at the responses. They should now be
genuinely different from each other and specific to your question, not
the generic dummy text you saw in Phase One. Each may end with a
"HANDOFF" line that is parsed out and rendered as a handoff note.

## Troubleshooting

**Provider failure card appears for one of the panes.** Check that the
key for that provider is set correctly in `.env.local` and that you
restarted the dev server after editing the file. Most first-time failures
are missing keys, malformed keys, or unrestarted servers.

**Auth error in the failure card.** Your key is invalid or expired, or
the provider has not received billing setup yet. For OpenAI and Anthropic,
verify you have credit on your account. For Google, verify the key was
created at https://aistudio.google.com/app/apikey.

**Rate limit error.** You are dispatching too quickly. Wait a minute and
try again. If it persists, your provider account has hit a per-minute
limit, which usually means your tier is the lowest one.

**Timeout error.** The provider took longer than 30 seconds to respond.
This is rare but happens, especially under high provider load. Just
re-dispatch.

**All three panes show the same failure.** Your `.env.local` file is not
being loaded. Confirm the filename is exactly `.env.local` (with the
leading dot, no extra extension), that it lives in the project root, and
that you restarted the dev server after creating it.

## What to look for in the first real run

The original review identified one central unverified assumption: that
the three roles, when given distinct system prompts, will produce
genuinely complementary responses rather than three variations on the
same answer. The first real run is your first chance to find out.

Pay attention to whether the architect's response is structurally
different from the strategist's response, and whether the reviewer's
response actually surfaces things the other two missed. If the three
responses feel substantively different, the multi-model architecture is
earning its complexity. If they feel like three rephrasings of the same
answer, the persona prompts need work and that is itself a useful
finding to capture as a decision.

This is the question Phase Two was built to answer.
