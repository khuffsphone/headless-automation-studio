// src/app/api/decision/route.ts
//
// POST /api/decision
//
// Receives a complete decision record body, validates that all required
// fields are present and that the quality checklist contains responses to
// all five prompts, persists the decision to decisions.json, and regenerates
// exports/decisions.md from the canonical store.
//
// Validation is strict: a partial record is rejected with a 400 response and
// a specific field-level error message. This is the primary defense against
// decision quality decay.

import { NextResponse } from "next/server";
import {
  appendDecision,
  readDecisions,
  regenerateDecisionsMarkdown,
} from "@/lib/storage";
import type {
  Decision,
  DecisionQualityChecklist,
  DecisionSource,
  RejectedAlternative,
} from "@/types/schema";

interface DecisionRequestBody {
  thread_id: string;
  project_id: string;
  originating_question: string;
  accepted_proposal: string;
  source: DecisionSource;
  rejected_alternatives?: RejectedAlternative[];
  operator_rationale?: string;
  architectural_scope?: string;
  dependencies?: string[];
  constraints?: string[];
  open_questions?: string[];
  decision_quality_checklist: DecisionQualityChecklist;
}

const VALID_SOURCES: DecisionSource[] = [
  "chatgpt",
  "gemini",
  "claude",
  "operator",
  "synthesized",
];

function randomId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

interface ValidationFailure {
  field: string;
  message: string;
}

function validate(body: DecisionRequestBody): ValidationFailure[] {
  const failures: ValidationFailure[] = [];

  if (!body.thread_id?.trim()) {
    failures.push({ field: "thread_id", message: "thread_id is required." });
  }
  if (!body.project_id?.trim()) {
    failures.push({ field: "project_id", message: "project_id is required." });
  }
  if (!body.originating_question?.trim()) {
    failures.push({
      field: "originating_question",
      message: "originating_question must be non-empty.",
    });
  }
  if (!body.accepted_proposal?.trim()) {
    failures.push({
      field: "accepted_proposal",
      message: "accepted_proposal must be non-empty.",
    });
  }
  if (!VALID_SOURCES.includes(body.source)) {
    failures.push({
      field: "source",
      message: `source must be one of: ${VALID_SOURCES.join(", ")}.`,
    });
  }

  const c = body.decision_quality_checklist;
  if (!c || typeof c !== "object") {
    failures.push({
      field: "decision_quality_checklist",
      message: "decision_quality_checklist is required.",
    });
  } else {
    // The five mandatory prompts. Each must be an explicit boolean; missing
    // or non-boolean values are rejected so the operator cannot accidentally
    // skip a prompt.
    const required: Array<keyof DecisionQualityChecklist> = [
      "specific_enough",
      "scope_in_identified",
      "scope_out_identified",
      "dependencies_captured",
      "ready_for_execution",
    ];
    for (const key of required) {
      if (typeof c[key] !== "boolean") {
        failures.push({
          field: `decision_quality_checklist.${key}`,
          message: `decision_quality_checklist.${key} must be an explicit boolean.`,
        });
      }
    }
  }

  return failures;
}

export async function POST(request: Request): Promise<Response> {
  let body: DecisionRequestBody;
  try {
    body = (await request.json()) as DecisionRequestBody;
  } catch {
    return NextResponse.json(
      { error: "invalid_json", message: "Request body is not valid JSON." },
      { status: 400 },
    );
  }

  const failures = validate(body);
  if (failures.length > 0) {
    return NextResponse.json(
      { error: "validation_failed", failures },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const checklist = body.decision_quality_checklist;

  const decision: Decision = {
    decision_id: randomId("dec"),
    project_id: body.project_id,
    thread_id: body.thread_id,
    originating_question: body.originating_question,
    accepted_proposal: body.accepted_proposal,
    source: body.source,
    rejected_alternatives: body.rejected_alternatives ?? [],
    operator_rationale: body.operator_rationale,
    architectural_scope: body.architectural_scope ?? "unspecified",
    execution_status: "approved_not_executed",
    // The fifth checklist prompt determines downstream_task_ready, per the
    // design document section 9.
    downstream_task_ready: checklist.ready_for_execution,
    dependencies: body.dependencies ?? [],
    constraints: body.constraints ?? [],
    open_questions: body.open_questions ?? [],
    decision_quality_checklist: checklist,
    created_at: now,
    updated_at: now,
  };

  appendDecision(decision);
  regenerateDecisionsMarkdown();

  return NextResponse.json({
    decision,
    decision_count: readDecisions().length,
  });
}

export async function GET(): Promise<Response> {
  return NextResponse.json({ decisions: readDecisions() });
}
