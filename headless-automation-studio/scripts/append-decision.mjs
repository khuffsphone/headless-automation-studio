#!/usr/bin/env node
// scripts/append-decision.mjs
//
// HAS-LOCAL-001 — Append a new decision to has-data/decisions.json and
// regenerate has-data/exports/decisions.md without requiring the browser
// UI or a running Next.js server.
//
// Usage:
//   node scripts/append-decision.mjs <path-to-input.json>
//   npm run has:append -- <path-to-input.json>
//
// The input JSON must conform to the same shape as the POST /api/decision
// body, plus an optional "execution_status" field (default:
// "approved_not_executed").
//
// Append-only: no existing record is modified. Exit 0 on success.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const STORAGE_ROOT = path.join(REPO_ROOT, "has-data");
const DECISIONS_FILE = path.join(STORAGE_ROOT, "decisions.json");
const EXPORTS_DIR = path.join(STORAGE_ROOT, "exports");
const DECISIONS_MD_FILE = path.join(EXPORTS_DIR, "decisions.md");

// ---------------------------------------------------------------------------
// Constants mirroring src/types/schema.ts
// ---------------------------------------------------------------------------

const VALID_SOURCES = ["chatgpt", "gemini", "claude", "operator", "synthesized"];
const VALID_EXECUTION_STATUSES = [
  "approved_not_executed",
  "in_progress",
  "executed",
  "superseded",
];
const REQUIRED_CHECKLIST_KEYS = [
  "specific_enough",
  "scope_in_identified",
  "scope_out_identified",
  "dependencies_captured",
  "ready_for_execution",
];

// ---------------------------------------------------------------------------
// Validation (mirrors the logic in src/app/api/decision/route.ts)
// ---------------------------------------------------------------------------

function validate(body) {
  const failures = [];

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

  const status = body.execution_status ?? "approved_not_executed";
  if (!VALID_EXECUTION_STATUSES.includes(status)) {
    failures.push({
      field: "execution_status",
      message: `execution_status must be one of: ${VALID_EXECUTION_STATUSES.join(", ")}.`,
    });
  }

  const c = body.decision_quality_checklist;
  if (!c || typeof c !== "object") {
    failures.push({
      field: "decision_quality_checklist",
      message: "decision_quality_checklist is required.",
    });
  } else {
    for (const key of REQUIRED_CHECKLIST_KEYS) {
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

// ---------------------------------------------------------------------------
// Storage boundary guard (mirrors assertWithinStorage in src/lib/storage.ts)
// ---------------------------------------------------------------------------

function assertWithinStorage(absolutePath) {
  const resolved = path.resolve(absolutePath);
  const root = path.resolve(STORAGE_ROOT);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error(
      `Storage boundary violation: ${resolved} is outside ${root}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function readDecisions() {
  assertWithinStorage(DECISIONS_FILE);
  if (!fs.existsSync(DECISIONS_FILE)) return [];
  const raw = fs.readFileSync(DECISIONS_FILE, "utf-8").trim();
  if (!raw) return [];
  return JSON.parse(raw);
}

function writeDecisions(decisions) {
  assertWithinStorage(DECISIONS_FILE);
  fs.writeFileSync(DECISIONS_FILE, JSON.stringify(decisions, null, 2), "utf-8");
}

// ---------------------------------------------------------------------------
// Markdown regeneration (mirrors regenerateDecisionsMarkdown in storage.ts)
// ---------------------------------------------------------------------------

function regenerateDecisionsMarkdown(decisions) {
  assertWithinStorage(DECISIONS_MD_FILE);
  if (!fs.existsSync(EXPORTS_DIR)) fs.mkdirSync(EXPORTS_DIR, { recursive: true });

  if (decisions.length === 0) {
    fs.writeFileSync(DECISIONS_MD_FILE, "# Decision Log\n\nNo decisions captured yet.\n", "utf-8");
    return;
  }

  const lines = ["# Decision Log", ""];

  for (const d of decisions) {
    lines.push(`## ${d.decision_id} — ${d.architectural_scope || "decision"}`);
    lines.push("");
    lines.push(`**Created:** ${d.created_at}`);
    lines.push(`**Source:** ${d.source}`);
    lines.push(`**Execution status:** ${d.execution_status}`);
    lines.push(`**Downstream task ready:** ${d.downstream_task_ready ? "yes" : "no"}`);
    lines.push("");
    lines.push("### Originating question");
    lines.push("");
    lines.push(d.originating_question);
    lines.push("");
    lines.push("### Accepted proposal");
    lines.push("");
    lines.push(d.accepted_proposal);
    lines.push("");

    if (d.operator_rationale) {
      lines.push("### Operator rationale");
      lines.push("");
      lines.push(d.operator_rationale);
      lines.push("");
    }

    if (d.rejected_alternatives.length > 0) {
      lines.push("### Rejected alternatives");
      lines.push("");
      for (const alt of d.rejected_alternatives) {
        lines.push(`- **${alt.source}:** ${alt.summary}`);
        lines.push(`  - *Rejected because:* ${alt.reason_rejected}`);
      }
      lines.push("");
    }

    if (d.dependencies.length > 0) {
      lines.push("### Dependencies");
      lines.push("");
      for (const dep of d.dependencies) lines.push(`- ${dep}`);
      lines.push("");
    }

    if (d.constraints.length > 0) {
      lines.push("### Constraints");
      lines.push("");
      for (const c of d.constraints) lines.push(`- ${c}`);
      lines.push("");
    }

    if (d.open_questions.length > 0) {
      lines.push("### Open questions");
      lines.push("");
      for (const q of d.open_questions) lines.push(`- ${q}`);
      lines.push("");
    }

    lines.push("### Quality checklist");
    lines.push("");
    const c = d.decision_quality_checklist;
    lines.push(`- Specific enough: ${c.specific_enough ? "yes" : "no"}`);
    lines.push(`- In-scope identified: ${c.scope_in_identified ? "yes" : "no"}`);
    lines.push(`- Out-of-scope identified: ${c.scope_out_identified ? "yes" : "no"}`);
    lines.push(`- Dependencies captured: ${c.dependencies_captured ? "yes" : "no"}`);
    lines.push(`- Ready for execution: ${c.ready_for_execution ? "yes" : "no"}`);
    if (c.notes) lines.push(`- Notes: ${c.notes}`);
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  fs.writeFileSync(DECISIONS_MD_FILE, lines.join("\n"), "utf-8");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const inputPath = process.argv[2];

  if (!inputPath) {
    console.error("Usage: node scripts/append-decision.mjs <path-to-input.json>");
    console.error("       npm run has:append -- <path-to-input.json>");
    process.exit(1);
  }

  const resolvedInput = path.resolve(inputPath);
  if (!fs.existsSync(resolvedInput)) {
    console.error(`Error: input file not found: ${resolvedInput}`);
    process.exit(1);
  }

  // Parse input
  let body;
  try {
    body = JSON.parse(fs.readFileSync(resolvedInput, "utf-8"));
  } catch (err) {
    console.error(`Error: input file is not valid JSON — ${err.message}`);
    process.exit(1);
  }

  // Validate
  const failures = validate(body);
  if (failures.length > 0) {
    console.error("Validation failed:");
    for (const f of failures) {
      console.error(`  [${f.field}] ${f.message}`);
    }
    process.exit(1);
  }

  // Build decision record
  const now = new Date().toISOString();
  const checklist = body.decision_quality_checklist;
  const executionStatus = body.execution_status ?? "approved_not_executed";

  const decision = {
    decision_id: randomId("dec"),
    project_id: body.project_id,
    thread_id: body.thread_id,
    originating_question: body.originating_question,
    accepted_proposal: body.accepted_proposal,
    source: body.source,
    rejected_alternatives: body.rejected_alternatives ?? [],
    ...(body.operator_rationale !== undefined
      ? { operator_rationale: body.operator_rationale }
      : {}),
    architectural_scope: body.architectural_scope ?? "unspecified",
    execution_status: executionStatus,
    downstream_task_ready: checklist.ready_for_execution,
    dependencies: body.dependencies ?? [],
    constraints: body.constraints ?? [],
    open_questions: body.open_questions ?? [],
    decision_quality_checklist: checklist,
    created_at: now,
    updated_at: now,
  };

  // Append and regenerate
  const decisions = readDecisions();
  decisions.push(decision);
  writeDecisions(decisions);
  regenerateDecisionsMarkdown(decisions);

  console.log(
    `✔ Appended ${decision.decision_id} (${decision.architectural_scope}) — total: ${decisions.length} decisions`,
  );
  console.log(`  decisions.json : ${DECISIONS_FILE}`);
  console.log(`  decisions.md   : ${DECISIONS_MD_FILE}`);
}

main();
