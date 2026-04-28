"use client";

// src/components/OperatorInput.tsx
//
// Composition area for the operator's question. Submit button is disabled
// while a dispatch is in flight so a single question cannot be submitted
// twice in rapid succession.
//
// HAS-007: Pre-debate input lint runs on submit. If lint errors are present,
// dispatch is blocked and errors are shown inline. Lint errors clear when the
// operator edits the draft.

import { useState } from "react";
import { lintQuestion, type LintError } from "@/lib/questionLinter";

interface OperatorInputProps {
  disabled: boolean;
  onSubmit: (question: string) => void;
}

export default function OperatorInput({ disabled, onSubmit }: OperatorInputProps) {
  const [draft, setDraft] = useState("");
  const [lintErrors, setLintErrors] = useState<LintError[]>([]);

  const trimmed = draft.trim();
  const canSubmit = !disabled && trimmed.length > 0;

  function handleDraftChange(value: string) {
    setDraft(value);
    // Clear lint errors as soon as the operator edits — re-evaluated on next submit.
    if (lintErrors.length > 0) setLintErrors([]);
  }

  function handleSubmit() {
    if (!canSubmit) return;

    // HAS-007: Run lint before dispatch. Block on any error.
    const result = lintQuestion(trimmed);
    if (!result.valid) {
      setLintErrors(result.errors);
      return;
    }

    setLintErrors([]);
    onSubmit(trimmed);
    setDraft("");
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <label className="block text-sm font-semibold text-slate-800">
        Operator question
      </label>
      <p className="mb-2 text-xs text-slate-500">
        One question dispatches in parallel to all three model roles. Input is
        linted before dispatch — vague, multi-objective, or boundary-free prompts
        are blocked with clarification guidance.
      </p>
      <textarea
        value={draft}
        onChange={(e) => handleDraftChange(e.target.value)}
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

      {/* HAS-007 lint error panel */}
      {lintErrors.length > 0 && (
        <div
          className="mt-2 rounded border border-rose-300 bg-rose-50 p-3"
          role="alert"
          aria-live="polite"
        >
          <p className="mb-2 text-[11px] font-semibold text-rose-800">
            ⛔ Prompt blocked — clarify before dispatch ({lintErrors.length} issue
            {lintErrors.length === 1 ? "" : "s"}):
          </p>
          <ul className="space-y-2">
            {lintErrors.map((e) => (
              <li key={e.rule_id} className="text-[11px] text-rose-800">
                <span className="font-semibold">[{e.rule_id}]</span> {e.message}
                <div className="mt-0.5 text-[10px] text-rose-600">
                  💡 {e.recommended_fix}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-2 flex items-center justify-between">
        <span className="text-[10px] text-slate-400">
          Tip: Ctrl/Cmd+Enter to submit.
        </span>
        <button
          type="button"
          id="dispatch-btn"
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
