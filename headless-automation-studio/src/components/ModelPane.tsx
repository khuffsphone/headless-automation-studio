"use client";

// src/components/ModelPane.tsx
//
// Renders a single model's response within the three-pane response view.
// Uses react-markdown for body rendering, displays the specialization tag
// prominently, renders the handoff_note as a secondary annotation when
// present, and renders a provider_failure card when the message status is
// "provider_failure". A "Copy to Synthesis" button populates the synthesis
// area with this pane's content.

import ReactMarkdown from "react-markdown";
import type { Message, MessageSpecialization } from "@/types/schema";

interface ModelPaneProps {
  title: string;
  specialization: MessageSpecialization;
  message?: Message;
  loading: boolean;
  onCopyToSynthesis: (message: Message) => void;
}

const SPECIALIZATION_LABEL: Record<MessageSpecialization, string> = {
  operator: "Operator",
  systems_architect: "Systems Architect",
  implementation_strategist: "Implementation Strategist",
  reviewer_synthesizer: "Reviewer & Synthesizer",
  system: "System",
};

export default function ModelPane({
  title,
  specialization,
  message,
  loading,
  onCopyToSynthesis,
}: ModelPaneProps) {
  return (
    <article className="flex h-full flex-col rounded-md border border-slate-200 bg-white shadow-sm">
      <header className="flex items-baseline justify-between border-b border-slate-200 px-3 py-2">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <span className="text-xs uppercase tracking-wide text-slate-500">
          {SPECIALIZATION_LABEL[specialization]}
        </span>
      </header>

      <div className="flex-1 overflow-auto px-3 py-3 text-sm text-slate-800">
        {loading && !message && (
          <div className="flex items-center gap-2 text-slate-500">
            <span className="h-2 w-2 animate-pulse rounded-full bg-slate-400" />
            <span className="text-xs">Awaiting response…</span>
          </div>
        )}

        {!loading && !message && (
          <div className="text-xs italic text-slate-400">
            No response yet. Submit a question to populate this pane.
          </div>
        )}

        {message && message.status === "provider_failure" && (
          <div className="rounded border border-rose-300 bg-rose-50 p-3 text-xs text-rose-900">
            <div className="font-semibold">Provider failure</div>
            <div className="mt-1">
              {message.model_metadata?.provider ?? "unknown provider"} —{" "}
              {message.model_metadata?.model ?? "unknown model"}
            </div>
            <div className="mt-1 text-rose-700">
              {message.body_markdown || "No further detail."}
            </div>
            <div className="mt-1 text-[10px] text-rose-700/70">
              {message.created_at}
            </div>
            <div className="mt-2 italic">
              This response was omitted from decision consideration.
            </div>
          </div>
        )}

        {message && message.status !== "provider_failure" && (
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown>{message.body_markdown}</ReactMarkdown>

            {message.handoff_note && (
              <aside className="mt-3 rounded border border-sky-200 bg-sky-50 p-2 text-xs text-sky-900">
                <span className="font-semibold">Handoff note:</span>{" "}
                {message.handoff_note}
              </aside>
            )}
          </div>
        )}
      </div>

      <footer className="flex items-center justify-between border-t border-slate-200 px-3 py-2">
        <span className="text-[10px] text-slate-400">
          {message?.model_metadata?.model ?? "—"}
        </span>
        <button
          type="button"
          disabled={!message || message.status === "provider_failure"}
          onClick={() => message && onCopyToSynthesis(message)}
          className="rounded bg-slate-800 px-2 py-1 text-xs font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Copy to Synthesis
        </button>
      </footer>
    </article>
  );
}
