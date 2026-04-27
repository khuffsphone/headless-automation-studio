"use client";

// src/components/QualityChecklist.tsx
//
// The mandatory five-prompt quality checklist that gates decision capture.
//
// Per the design document (section 9, Revision 2), each prompt requires an
// explicit response with no default value, and the Save Decision button in
// the SynthesisArea must remain disabled until all five prompts have been
// answered. This component reports completion status to its parent so the
// gate can be enforced.

import type { DecisionQualityChecklist } from "@/types/schema";

export type ChecklistDraft = {
  specific_enough: boolean | null;
  scope_in_identified: boolean | null;
  scope_out_identified: boolean | null;
  dependencies_captured: boolean | null;
  ready_for_execution: boolean | null;
  notes?: string;
};

export const EMPTY_CHECKLIST: ChecklistDraft = {
  specific_enough: null,
  scope_in_identified: null,
  scope_out_identified: null,
  dependencies_captured: null,
  ready_for_execution: null,
  notes: "",
};

export function isChecklistComplete(draft: ChecklistDraft): boolean {
  return (
    typeof draft.specific_enough === "boolean" &&
    typeof draft.scope_in_identified === "boolean" &&
    typeof draft.scope_out_identified === "boolean" &&
    typeof draft.dependencies_captured === "boolean" &&
    typeof draft.ready_for_execution === "boolean"
  );
}

export function checklistToFinal(draft: ChecklistDraft): DecisionQualityChecklist {
  if (!isChecklistComplete(draft)) {
    throw new Error("Quality checklist is not complete.");
  }
  return {
    specific_enough: draft.specific_enough as boolean,
    scope_in_identified: draft.scope_in_identified as boolean,
    scope_out_identified: draft.scope_out_identified as boolean,
    dependencies_captured: draft.dependencies_captured as boolean,
    ready_for_execution: draft.ready_for_execution as boolean,
    notes: draft.notes?.trim() ? draft.notes.trim() : undefined,
  };
}

interface QualityChecklistProps {
  value: ChecklistDraft;
  onChange: (next: ChecklistDraft) => void;
}

interface PromptDef {
  key: keyof Omit<ChecklistDraft, "notes">;
  question: string;
  helper?: string;
}

const PROMPTS: PromptDef[] = [
  {
    key: "specific_enough",
    question:
      "Is the decision specific enough to be understood later by someone returning to it without the surrounding conversation?",
  },
  {
    key: "scope_in_identified",
    question: "Does the decision identify what is in scope?",
  },
  {
    key: "scope_out_identified",
    question: "Does the decision identify what is out of scope?",
  },
  {
    key: "dependencies_captured",
    question: "Are dependencies or blockers captured?",
  },
  {
    key: "ready_for_execution",
    question:
      "Is this decision ready for downstream execution, or planning-only?",
    helper:
      "Yes = ready for execution. No = planning-only. This response sets downstream_task_ready on the decision record.",
  },
];

export default function QualityChecklist({
  value,
  onChange,
}: QualityChecklistProps) {
  const setBoolean = (key: PromptDef["key"], answer: boolean) => {
    onChange({ ...value, [key]: answer });
  };

  const setNotes = (notes: string) => {
    onChange({ ...value, notes });
  };

  const complete = isChecklistComplete(value);

  return (
    <section
      aria-label="Decision quality checklist"
      className="rounded-md border border-amber-300 bg-amber-50 p-4"
    >
      <header className="mb-3 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold text-amber-900">
          Decision quality checklist (required)
        </h3>
        <span
          className={`text-xs font-medium ${
            complete ? "text-emerald-700" : "text-amber-800"
          }`}
        >
          {complete ? "Complete" : "Incomplete"}
        </span>
      </header>

      <p className="mb-4 text-xs text-amber-900/80">
        All five prompts require an explicit answer. The Save Decision button
        is disabled until every prompt has been answered.
      </p>

      <ol className="space-y-3">
        {PROMPTS.map((p, idx) => {
          const current = value[p.key];
          return (
            <li
              key={p.key}
              className="rounded border border-amber-200 bg-white p-3"
            >
              <div className="text-sm font-medium text-slate-800">
                {idx + 1}. {p.question}
              </div>
              {p.helper && (
                <div className="mt-1 text-xs text-slate-500">{p.helper}</div>
              )}
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setBoolean(p.key, true)}
                  className={`rounded px-3 py-1 text-xs font-medium transition ${
                    current === true
                      ? "bg-emerald-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setBoolean(p.key, false)}
                  className={`rounded px-3 py-1 text-xs font-medium transition ${
                    current === false
                      ? "bg-rose-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  No
                </button>
                {current === null && (
                  <span className="self-center text-xs text-amber-700">
                    No response yet
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <label className="mt-3 block text-xs font-medium text-slate-700">
        Optional notes
        <textarea
          value={value.notes ?? ""}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-sm text-slate-800 focus:border-amber-500 focus:outline-none"
          placeholder="Optional free-text note about this assessment."
        />
      </label>
    </section>
  );
}
