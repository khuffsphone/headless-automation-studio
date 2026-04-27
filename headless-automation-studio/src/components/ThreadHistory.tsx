"use client";

// src/components/ThreadHistory.tsx
//
// Renders the messages.json state in chronological order with visible
// attribution to the originating role, the specialization tag, and the
// timestamp. Provider failure messages are rendered as distinct visual cards
// rather than hidden, in accordance with the design document's provider
// failure handling requirement.

import ReactMarkdown from "react-markdown";
import type { Message, MessageRole } from "@/types/schema";

interface ThreadHistoryProps {
  messages: Message[];
}

const ROLE_BADGE: Record<MessageRole, { label: string; className: string }> = {
  operator: { label: "Operator", className: "bg-slate-700 text-white" },
  chatgpt: { label: "ChatGPT", className: "bg-emerald-700 text-white" },
  gemini: { label: "Gemini", className: "bg-indigo-700 text-white" },
  claude: { label: "Claude", className: "bg-amber-700 text-white" },
  system: { label: "System", className: "bg-rose-700 text-white" },
};

export default function ThreadHistory({ messages }: ThreadHistoryProps) {
  if (messages.length === 0) {
    return (
      <section className="rounded-md border border-dashed border-slate-300 bg-white p-4 text-center text-xs text-slate-500">
        No messages yet. Submit a question to populate the thread.
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-slate-700">Thread history</h2>
      <ol className="space-y-2">
        {messages.map((m) => {
          const badge = ROLE_BADGE[m.role];
          const failed = m.status === "provider_failure";
          return (
            <li
              key={m.message_id}
              className={`rounded-md border p-3 text-sm shadow-sm ${
                failed
                  ? "border-rose-300 bg-rose-50"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="mb-2 flex items-baseline justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                  <span className="text-xs text-slate-500">
                    {m.specialization}
                  </span>
                  {failed && (
                    <span className="inline-flex items-center rounded bg-rose-200 px-2 py-0.5 text-[10px] font-semibold text-rose-900">
                      provider failure
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400">
                  {m.created_at}
                </span>
              </div>

              <div className="prose prose-sm max-w-none text-slate-800">
                <ReactMarkdown>{m.body_markdown}</ReactMarkdown>
              </div>

              {m.handoff_note && !failed && (
                <aside className="mt-2 rounded border border-sky-200 bg-sky-50 p-2 text-xs text-sky-900">
                  <span className="font-semibold">Handoff note:</span>{" "}
                  {m.handoff_note}
                </aside>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
