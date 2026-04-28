// src/app/api/decision/[id]/export/route.ts
//
// POST /api/decision/:id/export
//
// HAS-AG-001 one-way export gate.
//
// Checks that the target decision satisfies the export eligibility
// condition:
//   downstream_task_ready === true &&
//   execution_status === "approved_not_executed"
//
// On success:
//   1. Writes an immutable markdown snapshot to
//      has-data/exports/antigravity-tasks/<timestamp>-<id>.md
//   2. Advances execution_status → "in_progress" in decisions.json
//   3. Regenerates exports/decisions.md
//   4. Returns the file path and the updated decision
//
// HAS never reads back from the bridge directory. Bidirectional flow is
// explicitly out of scope for HAS-AG-001.

import { NextResponse } from "next/server";
import {
  readDecisions,
  regenerateDecisionsMarkdown,
  updateDecisionStatus,
  writeAgBridgeFile,
  BriefEnforcementError,
} from "@/lib/storage";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  if (!id?.trim()) {
    return NextResponse.json(
      { error: "missing_id", message: "Decision ID is required." },
      { status: 400 },
    );
  }

  // Find the decision
  const decisions = readDecisions();
  const decision = decisions.find((d) => d.decision_id === id);

  if (!decision) {
    return NextResponse.json(
      {
        error: "not_found",
        message: `Decision ${id} not found in decisions.json.`,
      },
      { status: 404 },
    );
  }

  // Export eligibility gate
  if (!decision.downstream_task_ready) {
    return NextResponse.json(
      {
        error: "not_eligible",
        message:
          "Decision is not eligible for export: downstream_task_ready is false.",
        decision_id: id,
        execution_status: decision.execution_status,
      },
      { status: 422 },
    );
  }

  if (decision.execution_status !== "approved_not_executed") {
    return NextResponse.json(
      {
        error: "not_eligible",
        message: `Decision is not eligible for export: execution_status is "${decision.execution_status}", expected "approved_not_executed".`,
        decision_id: id,
        execution_status: decision.execution_status,
      },
      { status: 422 },
    );
  }

  // Write immutable bridge file.
  // Brief enforcement runs inside writeAgBridgeFile before any I/O.
  // BriefEnforcementError → 422 with structured section errors.
  // Any other error → 500.
  let bridgeFilePath: string;
  try {
    bridgeFilePath = writeAgBridgeFile(decision);
  } catch (err) {
    if (err instanceof BriefEnforcementError) {
      return NextResponse.json(
        {
          error: "brief_enforcement_failed",
          message: err.message,
          enforcement_errors: err.errors,
          enforcement_warnings: err.warnings,
        },
        { status: 422 },
      );
    }
    return NextResponse.json(
      {
        error: "bridge_write_failed",
        message: `Failed to write bridge file: ${
          err instanceof Error ? err.message : String(err)
        }`,
      },
      { status: 500 },
    );
  }

  // Advance execution_status → in_progress
  const updatedDecisions = updateDecisionStatus(id, "in_progress");
  if (!updatedDecisions) {
    // Should be unreachable since we found the decision above, but guard anyway
    return NextResponse.json(
      {
        error: "status_update_failed",
        message: "Bridge file written but status update failed.",
        bridge_file: bridgeFilePath,
      },
      { status: 500 },
    );
  }

  // Regenerate markdown export so decisions.md reflects the status change
  regenerateDecisionsMarkdown();

  const updatedDecision = updatedDecisions.find((d) => d.decision_id === id);

  return NextResponse.json({
    exported: true,
    decision_id: id,
    bridge_file: bridgeFilePath,
    decision: updatedDecision,
  });
}
