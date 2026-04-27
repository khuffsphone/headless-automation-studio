// src/lib/providers.ts
//
// Phase Two: real provider integrations.
//
// Each function dispatches a single role's prompt to its assigned provider
// and returns either a proposal record or a provider-failure record. All
// three are called in parallel from the /api/ask route via Promise.allSettled,
// so a failure or timeout in one provider does not block the others.
//
// Keys are read from environment variables loaded via .env.local. If a key
// is missing, the corresponding provider returns a provider-failure record
// rather than throwing, so the dispatch loop continues to function with
// however many providers are configured.

import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ---------------------------------------------------------------------------
// Per-role system prompts
// ---------------------------------------------------------------------------
//
// These are hardcoded per the design document's Phase One discipline (no
// editable persona prompts in v0.1). They will become editable in a later
// phase once the multi-model premise has been validated.

const ARCHITECT_SYSTEM_PROMPT = `You are operating as the Systems Architect role in Headless Automation Studio, a structured multi-model decision room.

Your responsibilities:
- Decompose the operator's question into structural components.
- Identify dependencies and interfaces between those components.
- Flag architectural risks and scope concerns.
- Produce a proposal that is structural, not implementation-sequenced.

Constraints:
- Stay within the architect specialization. Do not produce build sequences (that is the strategist's role) or final synthesized recommendations (that is the reviewer's role).
- Keep your response under 400 words. The operator is comparing three responses side by side and verbosity reduces comparability.
- End your response with a single line of the form "HANDOFF: <short note targeted at the strategist or reviewer>" if you have specific guidance for one of the other roles. Omit this line if you do not.`;

const STRATEGIST_SYSTEM_PROMPT = `You are operating as the Implementation Strategist role in Headless Automation Studio, a structured multi-model decision room.

Your responsibilities:
- Translate structural considerations into concrete build sequences.
- Identify toolchain and environmental risks.
- Recommend what should be hardcoded versus deferred.
- Produce a proposal that is actionable, not purely structural.

Constraints:
- Stay within the strategist specialization. Do not produce architectural decompositions (that is the architect's role) or final synthesized recommendations (that is the reviewer's role).
- Keep your response under 400 words. The operator is comparing three responses side by side and verbosity reduces comparability.
- End your response with a single line of the form "HANDOFF: <short note targeted at the architect or reviewer>" if you have specific guidance for one of the other roles. Omit this line if you do not.`;

const REVIEWER_SYSTEM_PROMPT = `You are operating as the Reviewer and Synthesizer role in Headless Automation Studio, a structured multi-model decision room.

Your responsibilities:
- Critique the framing of the operator's question.
- Surface hidden assumptions that the architect or strategist would likely overlook.
- Produce a synthesized proposal that integrates or challenges the likely contributions of the other two roles.

Constraints:
- Stay within the reviewer specialization. You may anticipate what the architect and strategist will say, but do not duplicate their work.
- Keep your response under 400 words. The operator is comparing three responses side by side and verbosity reduces comparability.
- End your response with a single line of the form "HANDOFF: <short note targeted at the operator>" with specific guidance for the operator's decision capture, particularly around the in-scope/out-of-scope checklist items. Omit this line if you do not have specific guidance.`;

// ---------------------------------------------------------------------------
// Provider response shape
// ---------------------------------------------------------------------------

export interface ProviderResponse {
  ok: boolean;
  body_markdown: string;
  handoff_note?: string;
  error_category?: string;
  latency_ms: number;
  model_used: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Splits a model response on the trailing "HANDOFF:" line, returning the
 * primary body and the optional handoff note. The line must be on its own
 * and must start with "HANDOFF:" (case-insensitive). If no such line is
 * found, the entire response is returned as the body and the handoff note
 * is undefined.
 */
function extractHandoff(raw: string): { body: string; handoff?: string } {
  const lines = raw.trimEnd().split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line.length === 0) continue;
    if (/^handoff\s*:/i.test(line)) {
      const body = lines.slice(0, i).join("\n").trimEnd();
      const handoff = line.replace(/^handoff\s*:\s*/i, "").trim();
      return { body, handoff: handoff || undefined };
    }
    // First non-empty line from the end is not a handoff; stop searching.
    break;
  }
  return { body: raw.trimEnd() };
}

function categorizeError(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes("timeout") || msg.includes("etimedout")) return "timeout";
    if (msg.includes("rate") && msg.includes("limit")) return "rate_limit";
    if (msg.includes("auth") || msg.includes("api key") || msg.includes("401"))
      return "auth";
    if (msg.includes("network") || msg.includes("enotfound")) return "network";
    return err.name || "unknown";
  }
  return "unknown";
}

const REQUEST_TIMEOUT_MS = 30_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Request timeout after ${ms}ms`)),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

// ---------------------------------------------------------------------------
// OpenAI / ChatGPT — Systems Architect
// ---------------------------------------------------------------------------

const OPENAI_MODEL = "gpt-4o";

export async function callChatGPT(question: string): Promise<ProviderResponse> {
  const start = Date.now();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      body_markdown:
        "OpenAI API key not configured. Set OPENAI_API_KEY in .env.local and restart the dev server.",
      error_category: "missing_key",
      latency_ms: 0,
      model_used: OPENAI_MODEL,
    };
  }

  try {
    const client = new OpenAI({ apiKey });
    const completion = await withTimeout(
      client.chat.completions.create({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: ARCHITECT_SYSTEM_PROMPT },
          { role: "user", content: question },
        ],
        temperature: 0.7,
      }),
      REQUEST_TIMEOUT_MS,
    );

    const raw = completion.choices[0]?.message?.content ?? "";
    const { body, handoff } = extractHandoff(raw);
    return {
      ok: true,
      body_markdown: body,
      handoff_note: handoff,
      latency_ms: Date.now() - start,
      model_used: OPENAI_MODEL,
    };
  } catch (err) {
    return {
      ok: false,
      body_markdown:
        err instanceof Error ? err.message : "OpenAI call failed.",
      error_category: categorizeError(err),
      latency_ms: Date.now() - start,
      model_used: OPENAI_MODEL,
    };
  }
}

// ---------------------------------------------------------------------------
// Google Gemini — Implementation Strategist
// ---------------------------------------------------------------------------

const GEMINI_MODEL = "gemini-2.5-pro";

export async function callGemini(question: string): Promise<ProviderResponse> {
  const start = Date.now();
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      body_markdown:
        "Google API key not configured. Set GOOGLE_API_KEY in .env.local and restart the dev server.",
      error_category: "missing_key",
      latency_ms: 0,
      model_used: GEMINI_MODEL,
    };
  }

  try {
    const client = new GoogleGenerativeAI(apiKey);
    const model = client.getGenerativeModel({
      model: GEMINI_MODEL,
      systemInstruction: STRATEGIST_SYSTEM_PROMPT,
    });

    const result = await withTimeout(
      model.generateContent(question),
      REQUEST_TIMEOUT_MS,
    );
    const raw = result.response.text();
    const { body, handoff } = extractHandoff(raw);
    return {
      ok: true,
      body_markdown: body,
      handoff_note: handoff,
      latency_ms: Date.now() - start,
      model_used: GEMINI_MODEL,
    };
  } catch (err) {
    return {
      ok: false,
      body_markdown:
        err instanceof Error ? err.message : "Gemini call failed.",
      error_category: categorizeError(err),
      latency_ms: Date.now() - start,
      model_used: GEMINI_MODEL,
    };
  }
}

// ---------------------------------------------------------------------------
// Anthropic Claude — Reviewer & Synthesizer
// ---------------------------------------------------------------------------

const CLAUDE_MODEL = "claude-sonnet-4-5";

export async function callClaude(question: string): Promise<ProviderResponse> {
  const start = Date.now();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      body_markdown:
        "Anthropic API key not configured. Set ANTHROPIC_API_KEY in .env.local and restart the dev server.",
      error_category: "missing_key",
      latency_ms: 0,
      model_used: CLAUDE_MODEL,
    };
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await withTimeout(
      client.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 1024,
        system: REVIEWER_SYSTEM_PROMPT,
        messages: [{ role: "user", content: question }],
      }),
      REQUEST_TIMEOUT_MS,
    );

    const raw = response.content
      .filter((block) => block.type === "text")
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("\n");
    const { body, handoff } = extractHandoff(raw);
    return {
      ok: true,
      body_markdown: body,
      handoff_note: handoff,
      latency_ms: Date.now() - start,
      model_used: CLAUDE_MODEL,
    };
  } catch (err) {
    return {
      ok: false,
      body_markdown:
        err instanceof Error ? err.message : "Claude call failed.",
      error_category: categorizeError(err),
      latency_ms: Date.now() - start,
      model_used: CLAUDE_MODEL,
    };
  }
}
