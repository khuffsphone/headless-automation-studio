"use client";

// src/components/OperatorInput.tsx
//
// Composition area for the operator's question. Submit button is disabled
// while a dispatch is in flight so a single question cannot be submitted
// twice in rapid succession.

import { useState } from "react";

interface OperatorInputProps {
  disabled: boolean;
  onSubmit: (question: string) => void;
}

export default function OperatorInput({ disabled, onSubmit }: OperatorInputProps) {
  const [draft, setDraft] = useState("");

  const trimmed = draft.trim();
  const canSubmit = !disabled && trimmed.length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit(trimmed);
    setDraft("");
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <label className="block text-sm font-semibold text-slate-800">
        Operator question
      </label>
      <p className="mb-2 text-xs text-slate-500">
        One question dispatches in parallel to all three model roles. Phase
        One returns hardcoded dummy responses after a brief simulated latency.
      </p>
      <textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={3}
        disabled={disabled}
        className="w-full rounded border border-slate-300 bg-white p-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none disabled:bg-slate-50"
        placeholder="Pose a question to the room…"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            handleSubmit();
          }
        }}
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] text-slate-400">
          Tip: Ctrl/Cmd+Enter to submit.
        </span>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="rounded bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {disabled ? "Dispatching…" : "Dispatch to all three roles"}
        </button>
      </div>
    </section>
  );
}
