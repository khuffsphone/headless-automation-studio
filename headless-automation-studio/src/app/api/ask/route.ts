// src/app/api/ask/route.ts
//
// Phase Two: real provider dispatch.
//
// Receives an operator question and the active thread identifier. Persists
// the operator message immediately, then dispatches the question to all
// three providers in parallel via Promise.allSettled, persists the resulting
// messages (success or failure), and returns the full updated message array.
//
// Provider failures are persisted as messages with status="provider_failure"
// rather than being silently dropped, so the operator can see exactly which
// providers responded and which did not.

import { NextResponse } from "next/server";
import {
  appendMessage,
  appendMessages,
  readMessages,
  readThreads,
  updateThreadActivity,
} from "@/lib/storage";
import { callChatGPT, callGemini, callClaude } from "@/lib/providers";
import type {
  Message,
  MessageRole,
  MessageSpecialization,
  ModelMetadata,
} from "@/types/schema";

interface AskRequestBody {
  question: string;
  thread_id?: string;
  project_id?: string;
}

function randomId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

interface RoleConfig {
  role: MessageRole;
  specialization: MessageSpecialization;
  provider: ModelMetadata["provider"];
  call: (q: string) => Promise<
    | {
        ok: true;
        body_markdown: string;
        handoff_note?: string;
        latency_ms: number;
        model_used: string;
      }
    | {
        ok: false;
        body_markdown: string;
        error_category?: string;
        latency_ms: number;
        model_used: string;
      }
  >;
}

const ROLES: RoleConfig[] = [
  {
    role: "chatgpt",
    specialization: "systems_architect",
    provider: "openai",
    call: callChatGPT,
  },
  {
    role: "gemini",
    specialization: "implementation_strategist",
    provider: "google",
    call: callGemini,
  },
  {
    role: "claude",
    specialization: "reviewer_synthesizer",
    provider: "anthropic",
    call: callClaude,
  },
];

export async function POST(request: Request): Promise<Response> {
  let body: AskRequestBody;
  try {
    body = (await request.json()) as AskRequestBody;
  } catch {
    return NextResponse.json(
      { error: "invalid_json", message: "Request body is not valid JSON." },
      { status: 400 },
    );
  }

  const question = body.question?.trim();
  if (!question) {
    return NextResponse.json(
      {
        error: "missing_question",
        message: "Field `question` is required and must be non-empty.",
      },
      { status: 400 },
    );
  }

  const threads = readThreads();
  const thread =
    threads.find((t) => t.thread_id === body.thread_id) ?? threads[0];
  if (!thread) {
    return NextResponse.json(
      {
        error: "no_thread",
        message:
          "No thread is initialized in has-data/threads.json. Re-run setup.",
      },
      { status: 500 },
    );
  }

  const projectId = body.project_id ?? thread.project_id;
  const askedAt = new Date().toISOString();

  // Persist the operator message immediately.
  const operatorMessage: Message = {
    message_id: randomId("msg"),
    thread_id: thread.thread_id,
    project_id: projectId,
    created_at: askedAt,
    role: "operator",
    specialization: "operator",
    body_markdown: question,
    status: "neutral",
  };
  appendMessage(operatorMessage);
  updateThreadActivity(thread.thread_id, askedAt);

  // Dispatch all three providers concurrently. Promise.allSettled ensures
  // that one provider's failure does not block the others.
  const settled = await Promise.allSettled(
    ROLES.map((r) => r.call(question)),
  );

  const respondedAt = new Date().toISOString();
  const responseMessages: Message[] = settled.map((result, idx) => {
    const cfg = ROLES[idx];
    const baseId = randomId("msg");

    if (result.status === "rejected") {
      // Should be rare since the provider functions catch errors internally,
      // but Promise.allSettled accommodates it for safety.
      return {
        message_id: baseId,
        thread_id: thread.thread_id,
        project_id: projectId,
        created_at: respondedAt,
        role: cfg.role,
        specialization: cfg.specialization,
        parent_message_id: operatorMessage.message_id,
        body_markdown:
          result.reason instanceof Error
            ? result.reason.message
            : "Unexpected provider rejection.",
        status: "provider_failure",
        model_metadata: {
          provider: cfg.provider,
          model: "unknown",
        },
      };
    }

    const value = result.value;
    if (!value.ok) {
      return {
        message_id: baseId,
        thread_id: thread.thread_id,
        project_id: projectId,
        created_at: respondedAt,
        role: cfg.role,
        specialization: cfg.specialization,
        parent_message_id: operatorMessage.message_id,
        body_markdown: `**Provider failure (${value.error_category ?? "unknown"})**\n\n${value.body_markdown}`,
        status: "provider_failure",
        model_metadata: {
          provider: cfg.provider,
          model: value.model_used,
        },
      };
    }

    return {
      message_id: baseId,
      thread_id: thread.thread_id,
      project_id: projectId,
      created_at: respondedAt,
      role: cfg.role,
      specialization: cfg.specialization,
      parent_message_id: operatorMessage.message_id,
      body_markdown: value.body_markdown,
      status: "proposal",
      model_metadata: {
        provider: cfg.provider,
        model: value.model_used,
      },
      handoff_note: value.handoff_note,
    };
  });

  appendMessages(responseMessages);
  updateThreadActivity(thread.thread_id, respondedAt);

  return NextResponse.json({
    messages: readMessages(),
    operator_message_id: operatorMessage.message_id,
    response_message_ids: responseMessages.map((m) => m.message_id),
  });
}

export async function GET(): Promise<Response> {
  return NextResponse.json({ messages: readMessages() });
}
