"use client";

// src/app/page.tsx
//
// The single operator surface for Phase One. Composes the OperatorInput,
// the three-pane response view (ModelPane × 3), the SynthesisArea (which
// embeds the QualityChecklist), the ThreadHistory, and the DecisionLog.
//
// State management is intentionally simple: a flat messages array hydrated
// from /api/ask, and a flat decisions array hydrated from /api/decision.
// Phase One does not introduce a global state library or persistent client
// cache. The session store on disk is the source of truth.

import { useEffect, useMemo, useState } from "react";
import OperatorInput from "@/components/OperatorInput";
import ModelPane from "@/components/ModelPane";
import SynthesisArea from "@/components/SynthesisArea";
import ThreadHistory from "@/components/ThreadHistory";
import DecisionLog from "@/components/DecisionLog";
import type { Decision, DecisionSource, Message } from "@/types/schema";

// Defaults for Phase One. The real thread/project identifiers live in
// has-data/threads.json and has-data/project_context.json respectively;
// these constants are only used until the first dispatch/load returns the
// authoritative IDs from the server.
const DEFAULT_PROJECT_ID = "headless_automation_studio";
const DEFAULT_THREAD_TITLE = "Initial Validation Thread";

interface AskResponse {
  messages: Message[];
  operator_message_id?: string;
  response_message_ids?: string[];
}

export default function Page() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [dispatching, setDispatching] = useState(false);
  const [draftProposal, setDraftProposal] = useState("");
  const [draftSource, setDraftSource] = useState<DecisionSource>("synthesized");
  const [error, setError] = useState<string | null>(null);

  // Hydrate from disk on mount.
  useEffect(() => {
    void (async () => {
      try {
        const [askRes, decRes] = await Promise.all([
          fetch("/api/ask"),
          fetch("/api/decision"),
        ]);
        if (askRes.ok) {
          const data = (await askRes.json()) as AskResponse;
          setMessages(data.messages ?? []);
        }
        if (decRes.ok) {
          const data = (await decRes.json()) as { decisions: Decision[] };
          setDecisions(data.decisions ?? []);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to hydrate state.");
      }
    })();
  }, []);

  // Identify the current question/answer round: the most recent operator
  // message and the model responses that reference it as parent.
  const currentRound = useMemo(() => {
    const operatorMsgs = messages.filter((m) => m.role === "operator");
    const latestOperator = operatorMsgs[operatorMsgs.length - 1];
    if (!latestOperator) {
      return {
        operatorMessage: undefined as Message | undefined,
        chatgpt: undefined as Message | undefined,
        gemini: undefined as Message | undefined,
        claude: undefined as Message | undefined,
        responses: [] as Message[],
      };
    }
    const responses = messages.filter(
      (m) =>
        m.parent_message_id === latestOperator.message_id &&
        (m.role === "chatgpt" || m.role === "gemini" || m.role === "claude"),
    );
    return {
      operatorMessage: latestOperator,
      chatgpt: responses.find((m) => m.role === "chatgpt"),
      gemini: responses.find((m) => m.role === "gemini"),
      claude: responses.find((m) => m.role === "claude"),
      responses,
    };
  }, [messages]);

  const threadId =
    currentRound.operatorMessage?.thread_id ??
    messages[0]?.thread_id ??
    "thread_pending";
  const projectId =
    currentRound.operatorMessage?.project_id ??
    messages[0]?.project_id ??
    DEFAULT_PROJECT_ID;
  const originatingQuestion =
    currentRound.operatorMessage?.body_markdown ?? "";

  async function handleAsk(question: string) {
    setDispatching(true);
    setError(null);
    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question }),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as {
          error?: string;
          message?: string;
          lint_errors?: Array<{ rule_id: string; message: string; recommended_fix: string }>;
        };
        // HAS-007: surface server-side lint errors with per-rule detail.
        // (Client-side lint normally catches these first; this path is reached
        // only by API callers that bypass the UI.)
        if (
          errBody?.error === "prompt_lint_failed" &&
          Array.isArray(errBody?.lint_errors) &&
          errBody.lint_errors.length > 0
        ) {
          const detail = errBody.lint_errors
            .map((e) => `[${e.rule_id}] ${e.message}`)
            .join("\n");
          throw new Error(`Prompt blocked by input lint:\n${detail}`);
        }
        throw new Error(errBody?.message ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as AskResponse;
      setMessages(data.messages ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Dispatch failed.");
    } finally {
      setDispatching(false);
    }
  }

  function handleCopyToSynthesis(message: Message) {
    setDraftProposal(message.body_markdown);
    if (
      message.role === "chatgpt" ||
      message.role === "gemini" ||
      message.role === "claude"
    ) {
      setDraftSource(message.role);
    }
  }

  function handleDecisionSaved(decision: Decision) {
    setDecisions((prev) => [...prev, decision]);
  }

  function handleDecisionExported(updated: Decision) {
    setDecisions((prev) =>
      prev.map((d) => (d.decision_id === updated.decision_id ? updated : d)),
    );
  }

  return (
    <main className="mx-auto flex max-w-7xl flex-col gap-4 p-4 lg:p-6">
      <header className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-baseline justify-between">
          <h1 className="text-lg font-semibold text-slate-900">
            Headless Automation Studio — Layer One
          </h1>
          <span className="text-xs uppercase tracking-wide text-slate-500">
            Phase One · Dummy Responses
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Single operator · Single thread · Local persistence under{" "}
          <code className="rounded bg-slate-100 px-1 py-0.5 text-[10px]">
            has-data/
          </code>
          . No real provider calls. {DEFAULT_THREAD_TITLE}.
        </p>
      </header>

      {error && (
        <div className="rounded border border-rose-300 bg-rose-50 p-3 text-xs text-rose-900">
          {error}
        </div>
      )}

      <OperatorInput disabled={dispatching} onSubmit={handleAsk} />

      <section className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <ModelPane
          title="ChatGPT"
          specialization="systems_architect"
          message={currentRound.chatgpt}
          loading={dispatching}
          onCopyToSynthesis={handleCopyToSynthesis}
        />
        <ModelPane
          title="Gemini"
          specialization="implementation_strategist"
          message={currentRound.gemini}
          loading={dispatching}
          onCopyToSynthesis={handleCopyToSynthesis}
        />
        <ModelPane
          title="Claude"
          specialization="reviewer_synthesizer"
          message={currentRound.claude}
          loading={dispatching}
          onCopyToSynthesis={handleCopyToSynthesis}
        />
      </section>

      <SynthesisArea
        threadId={threadId}
        projectId={projectId}
        originatingQuestion={originatingQuestion}
        draftProposal={draftProposal}
        draftSource={draftSource}
        onDraftProposalChange={setDraftProposal}
        onDraftSourceChange={setDraftSource}
        candidateResponses={currentRound.responses}
        onDecisionSaved={handleDecisionSaved}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ThreadHistory messages={messages} />
        <DecisionLog decisions={decisions} onDecisionExported={handleDecisionExported} />
      </div>
    </main>
  );
}
