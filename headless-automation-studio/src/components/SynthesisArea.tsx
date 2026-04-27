"use client";

// src/components/SynthesisArea.tsx
//
// The decision capture workspace. Pre-populates the accepted proposal text
// from a copied model response, hosts the operator rationale and the
// dependencies / constraints / open_questions lists, embeds the mandatory
// QualityChecklist, and exposes a Save Decision button that is disabled
// until the checklist reports completion.

import { useMemo, useState } from "react";
import QualityChecklist, {
  EMPTY_CHECKLIST,
  isChecklistComplete,
  checklistToFinal,
  type ChecklistDraft,
} from "./QualityChecklist";
import type { Decision, DecisionSource, Message } from "@/types/schema";

interface SynthesisAreaProps {
  threadId: string;
  projectId: string;
  originatingQuestion: string;
  draftProposal: string;
  draftSource: DecisionSource;
  onDraftProposalChange: (next: string) => void;
  onDraftSourceChange: (next: DecisionSource) => void;
  candidateResponses: Message[];
  onDecisionSaved: (decision: Decision) => void;
}

const SOURCE_OPTIONS: DecisionSource[] = [
  "chatgpt",
  "gemini",
  "claude",
  "operator",
  "synthesized",
];

function splitLines(input: string): string[] {
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

export default function SynthesisArea({
  threadId,
  projectId,
  originatingQuestion,
  draftProposal,
  draftSource,
  onDraftProposalChange,
  onDraftSourceChange,
  candidateResponses,
  onDecisionSaved,
}: SynthesisAreaProps) {
  const [rationale, setRationale] = useState("");
  const [scope, setScope] = useState("");
  const [dependenciesText, setDependenciesText] = useState("");
  const [constraintsText, setConstraintsText] = useState("");
  const [openQuestionsText, setOpenQuestionsText] = useState("");
  const [checklist, setChecklist] = useState<ChecklistDraft>(EMPTY_CHECKLIST);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checklistComplete = isChecklistComplete(checklist);
  const proposalReady = draftProposal.trim().length > 0;
  const canSave = checklistComplete && proposalReady && !submitting;

  // Phase One: rejected_alternatives are derived as the candidate responses
  // that were not chosen as the source. The operator can later edit these
  // explicitly, but for v0.1 a sensible default keeps the decision record
  // populated without adding another form section.
  const derivedRejected = useMemo(() => {
    if (draftSource === "operator" || draftSource === "synthesized") {
      return candidateResponses.map((m) => ({
        source: m.role as DecisionSource,
        summary: m.body_markdown.slice(0, 200),
        reason_rejected: "Not selected as primary source.",
      }));
    }
    return candidateResponses
      .filter((m) => m.role !== draftSource)
      .map((m) => ({
        source: m.role as DecisionSource,
        summary: m.body_markdown.slice(0, 200),
        reason_rejected: "Not selected as primary source.",
      }));
  }, [candidateResponses, draftSource]);

  async function handleSave() {
    if (!canSave) return;
    setSubmitting(true);
    setError(null);

    try {
      const finalChecklist = checklistToFinal(checklist);
      const body = {
        thread_id: threadId,
        project_id: projectId,
        originating_question: originatingQuestion,
        accepted_proposal: draftProposal.trim(),
        source: draftSource,
        rejected_alternatives: derivedRejected,
        operator_rationale: rationale.trim() || undefined,
        architectural_scope: scope.trim() || "unspecified",
        dependencies: splitLines(dependenciesText),
        constraints: splitLines(constraintsText),
        open_questions: splitLines(openQuestionsText),
        decision_quality_checklist: finalChecklist,
      };

      const res = await fetch("/api/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        const msg =
          errBody?.failures
            ?.map((f: { field: string; message: string }) => `${f.field}: ${f.message}`)
            .join("; ") ?? errBody?.message ?? `HTTP ${res.status}`;
        throw new Error(msg);
      }

      const data: { decision: Decision } = await res.json();
      onDecisionSaved(data.decision);

      // Reset capture form.
      setRationale("");
      setScope("");
      setDependenciesText("");
      setConstraintsText("");
      setOpenQuestionsText("");
      setChecklist(EMPTY_CHECKLIST);
      onDraftProposalChange("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="rounded-md border border-slate-200 bg-white p-4 shadow-sm">
      <header className="mb-3">
        <h2 className="text-base font-semibold text-slate-800">
          Synthesis & Decision Capture
        </h2>
        <p className="text-xs text-slate-500">
          Edit the accepted proposal text, attribute the source, complete the
          quality checklist, then save the decision.
        </p>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="block text-xs font-medium text-slate-700 md:col-span-2">
          Accepted proposal
          <textarea
            value={draftProposal}
            onChange={(e) => onDraftProposalChange(e.target.value)}
            rows={6}
            className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none"
            placeholder="Use 'Copy to Synthesis' on a model pane, or compose a synthesized proposal here."
          />
        </label>

        <label className="block text-xs font-medium text-slate-700">
          Source
          <select
            value={draftSource}
            onChange={(e) =>
              onDraftSourceChange(e.target.value as DecisionSource)
            }
            className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none"
          >
            {SOURCE_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-medium text-slate-700">
          Architectural scope
          <input
            value={scope}
            onChange={(e) => setScope(e.target.value)}
            className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none"
            placeholder="e.g. layer_one_schema, capture_flow, validation"
          />
        </label>

        <label className="block text-xs font-medium text-slate-700 md:col-span-2">
          Operator rationale (optional)
          <textarea
            value={rationale}
            onChange={(e) => setRationale(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none"
            placeholder="Why this proposal, in your own words."
          />
        </label>

        <label className="block text-xs font-medium text-slate-700">
          Dependencies (one per line)
          <textarea
            value={dependenciesText}
            onChange={(e) => setDependenciesText(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none"
          />
        </label>

        <label className="block text-xs font-medium text-slate-700">
          Constraints (one per line)
          <textarea
            value={constraintsText}
            onChange={(e) => setConstraintsText(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none"
          />
        </label>

        <label className="block text-xs font-medium text-slate-700 md:col-span-2">
          Open questions (one per line)
          <textarea
            value={openQuestionsText}
            onChange={(e) => setOpenQuestionsText(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-sm text-slate-800 focus:border-sky-500 focus:outline-none"
          />
        </label>
      </div>

      <div className="mt-4">
        <QualityChecklist value={checklist} onChange={setChecklist} />
      </div>

      {error && (
        <div className="mt-3 rounded border border-rose-300 bg-rose-50 p-2 text-xs text-rose-900">
          {error}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <span className="text-xs text-slate-500">
          {checklistComplete
            ? "Quality checklist complete."
            : "Quality checklist incomplete — Save Decision is disabled."}
        </span>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {submitting ? "Saving…" : "Save Decision"}
        </button>
      </div>
    </section>
  );
}
