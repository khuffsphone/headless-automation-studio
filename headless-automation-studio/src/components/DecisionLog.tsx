"use client";

// src/components/DecisionLog.tsx
//
// Renders the captured decision records inline so the operator can see the
// loop close after Save Decision is pressed.
//
// HAS-AG-001: Adds an "Export to Antigravity" button on eligible decisions.
// A decision is eligible when:
//   downstream_task_ready === true && execution_status === "approved_not_executed"
//
// On a successful export the button is replaced by a "Exported → in_progress"
// badge without requiring a full page reload; the parent component's decisions
// array is updated via the onDecisionExported callback.

import { useState } from "react";
import type { Decision } from "@/types/schema";

interface BriefValidationError {
  section: string;
  message: string;
}

interface DecisionLogProps {
  decisions: Decision[];
  onDecisionExported?: (updated: Decision) => void;
}

function isExportEligible(d: Decision): boolean {
  return (
    d.downstream_task_ready === true &&
    d.execution_status === "approved_not_executed"
  );
}

interface ExportState {
  exporting: boolean;
  error: string | null;
  bridgeFile: string | null;
  enforcementErrors: BriefValidationError[];
  enforcementWarnings: string[];
}

function DecisionCard({
  decision,
  onExported,
}: {
  decision: Decision;
  onExported?: (updated: Decision) => void;
}) {
  const [exportState, setExportState] = useState<ExportState>({
    exporting: false,
    error: null,
    bridgeFile: null,
    enforcementErrors: [],
    enforcementWarnings: [],
  });

  const eligible = isExportEligible(decision);
  // Treat in_progress as already exported for display purposes
  const alreadyExported =
    decision.execution_status === "in_progress" || exportState.bridgeFile !== null;

  async function handleExport() {
    setExportState({ exporting: true, error: null, bridgeFile: null, enforcementErrors: [], enforcementWarnings: [] });
    try {
      const res = await fetch(`/api/decision/${decision.decision_id}/export`, {
        method: "POST",
      });
      const data = (await res.json()) as {
        exported?: boolean;
        bridge_file?: string;
        decision?: Decision;
        message?: string;
        enforcement_errors?: BriefValidationError[];
        enforcement_warnings?: string[];
      };
      if (!res.ok) {
        if (data.enforcement_errors && data.enforcement_errors.length > 0) {
          // Brief enforcement failed — surface per-section errors
          setExportState({
            exporting: false,
            error: data.message ?? "Brief enforcement failed.",
            bridgeFile: null,
            enforcementErrors: data.enforcement_errors,
            enforcementWarnings: data.enforcement_warnings ?? [],
          });
          return;
        }
        throw new Error(data.message ?? `HTTP ${res.status}`);
      }
      setExportState({
        exporting: false,
        error: null,
        bridgeFile: data.bridge_file ?? "exported",
        enforcementErrors: [],
        enforcementWarnings: data.enforcement_warnings ?? [],
      });
      if (data.decision && onExported) {
        onExported(data.decision);
      }
    } catch (e) {
      setExportState({
        exporting: false,
        error: e instanceof Error ? e.message : "Export failed.",
        bridgeFile: null,
        enforcementErrors: [],
        enforcementWarnings: [],
      });
    }
  }

  // Status badge color
  const statusColors: Record<string, string> = {
    approved_not_executed: "bg-amber-100 text-amber-800",
    in_progress: "bg-blue-100 text-blue-800",
    executed: "bg-emerald-100 text-emerald-800",
    superseded: "bg-slate-100 text-slate-500",
  };
  const statusColor =
    statusColors[decision.execution_status] ?? "bg-slate-100 text-slate-600";

  return (
    <li
      key={decision.decision_id}
      className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm shadow-sm"
    >
      {/* Header row */}
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-mono text-[10px] text-emerald-900/70">
          {decision.decision_id}
        </span>
        <div className="flex items-center gap-2">
          {/* Execution status badge */}
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${statusColor}`}
          >
            {decision.execution_status.replace(/_/g, " ")}
          </span>
          <span className="text-[10px] text-emerald-900/70">
            {decision.created_at}
          </span>
        </div>
      </div>

      {/* Scope / source / ready line */}
      <div className="text-xs uppercase tracking-wide text-emerald-900/80">
        {decision.architectural_scope} · source: {decision.source} ·{" "}
        {decision.downstream_task_ready ? "ready for execution" : "planning only"}
      </div>

      {/* Question excerpt */}
      <div className="mt-1 text-xs text-slate-700">
        <span className="font-semibold">Q:</span>{" "}
        {decision.originating_question}
      </div>

      {/* Proposal excerpt */}
      <div className="mt-1 text-sm text-slate-900">
        {decision.accepted_proposal.length > 240
          ? `${decision.accepted_proposal.slice(0, 240)}…`
          : decision.accepted_proposal}
      </div>

      {/* Export row */}
      <div className="mt-2 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          {alreadyExported ? (
            <span className="inline-flex items-center gap-1 rounded bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-800">
              ✓ Exported → in_progress
              {exportState.bridgeFile && (
                <span
                  className="ml-1 max-w-[220px] truncate font-mono text-[9px] text-blue-600"
                  title={exportState.bridgeFile}
                >
                  {exportState.bridgeFile.split(/[\\/]/).slice(-1)[0]}
                </span>
              )}
            </span>
          ) : eligible ? (
            <button
              id={`export-btn-${decision.decision_id}`}
              onClick={() => void handleExport()}
              disabled={exportState.exporting}
              className="rounded bg-violet-600 px-2.5 py-1 text-[11px] font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {exportState.exporting ? "Exporting…" : "Export to Antigravity"}
            </button>
          ) : null}

          {exportState.error && exportState.enforcementErrors.length === 0 && (
            <span className="text-[11px] text-rose-700">{exportState.error}</span>
          )}
        </div>

        {/* Brief enforcement errors — shown per-section */}
        {exportState.enforcementErrors.length > 0 && (
          <div className="rounded border border-rose-300 bg-rose-50 p-2">
            <p className="mb-1 text-[11px] font-semibold text-rose-800">
              ⛔ Export blocked — execution brief validation failed:
            </p>
            <ul className="space-y-1">
              {exportState.enforcementErrors.map((e) => (
                <li key={e.section} className="text-[11px] text-rose-700">
                  <span className="font-semibold">[{e.section}]</span>{" "}
                  {e.message}
                </li>
              ))}
            </ul>
            {exportState.enforcementWarnings.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {exportState.enforcementWarnings.map((w, i) => (
                  <li key={i} className="text-[10px] text-amber-700">
                    ⚠️ {w}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

export default function DecisionLog({
  decisions,
  onDecisionExported,
}: DecisionLogProps) {
  if (decisions.length === 0) {
    return (
      <section className="rounded-md border border-dashed border-slate-300 bg-white p-4 text-center text-xs text-slate-500">
        No decisions captured yet.
      </section>
    );
  }

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-slate-700">
        Decision log ({decisions.length})
      </h2>
      <ol className="space-y-2">
        {decisions
          .slice()
          .reverse()
          .map((d) => (
            <DecisionCard
              key={d.decision_id}
              decision={d}
              onExported={onDecisionExported}
            />
          ))}
      </ol>
    </section>
  );
}
