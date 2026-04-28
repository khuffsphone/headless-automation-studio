// src/lib/storage.ts
//
// Centralizes all file I/O against the has-data/ storage boundary.
// Every read and write in the application should go through this module,
// so that the boundary specified in section 2 of the design document is
// enforced in exactly one place.
//
// Note on synchronous I/O: Phase One uses fs.readFileSync / fs.writeFileSync
// because the single-operator local context does not produce enough
// concurrent activity to justify the complexity of asynchronous coordination,
// and synchronous writes provide straightforward consistency guarantees.
// If messages.json grows large enough to produce noticeable UI blocking in
// later phases, switch to async I/O with file locks.

import fs from "node:fs";
import path from "node:path";
import type {
  Decision,
  Message,
  ProjectContext,
  Thread,
} from "@/types/schema";
import { enforceExecutionBrief, type BriefValidationError } from "@/lib/briefEnforcer";

/**
 * Structured error thrown by writeAgBridgeFile when the brief enforcer
 * rejects a decision. The caller (export route) catches this and surfaces
 * the errors array in the API response rather than a generic 500 message.
 */
export class BriefEnforcementError extends Error {
  readonly errors: BriefValidationError[];
  readonly warnings: string[];
  constructor(errors: BriefValidationError[], warnings: string[]) {
    super(
      `Execution brief failed validation (${errors.length} error${
        errors.length === 1 ? "" : "s"
      }): ${errors.map((e) => e.section).join(", ")}`,
    );
    this.name = "BriefEnforcementError";
    this.errors = errors;
    this.warnings = warnings;
  }
}

const STORAGE_ROOT = path.resolve(process.cwd(), "has-data");
const EXPORTS_DIR = path.join(STORAGE_ROOT, "exports");

/**
 * Output directory for Antigravity task files exported via the HAS-AG-001
 * one-way publish contract. Lives inside has-data/exports/ so it is covered
 * by the storage boundary guard and included in the canonical export tree.
 */
const AG_TASKS_DIR = path.join(EXPORTS_DIR, "antigravity-tasks");

const MESSAGES_FILE = path.join(STORAGE_ROOT, "messages.json");
const DECISIONS_FILE = path.join(STORAGE_ROOT, "decisions.json");
const THREADS_FILE = path.join(STORAGE_ROOT, "threads.json");
const PROJECT_CONTEXT_FILE = path.join(STORAGE_ROOT, "project_context.json");
const DECISIONS_MD_FILE = path.join(EXPORTS_DIR, "decisions.md");

/**
 * Asserts that the given absolute path is inside the has-data/ storage root.
 * Provides a single enforcement point for the storage boundary specified in
 * section 2 of the design document.
 */
function assertWithinStorage(absolutePath: string): void {
  const resolved = path.resolve(absolutePath);
  const root = path.resolve(STORAGE_ROOT);
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    throw new Error(
      `Storage boundary violation: ${resolved} is outside ${root}`,
    );
  }
}

function readJson<T>(filePath: string, fallback: T): T {
  assertWithinStorage(filePath);
  if (!fs.existsSync(filePath)) {
    return fallback;
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  if (!raw.trim()) {
    return fallback;
  }
  return JSON.parse(raw) as T;
}

function writeJson(filePath: string, data: unknown): void {
  assertWithinStorage(filePath);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}

// ---------------------------------------------------------------------------
// Messages
// ---------------------------------------------------------------------------

export function readMessages(): Message[] {
  return readJson<Message[]>(MESSAGES_FILE, []);
}

export function appendMessage(message: Message): Message[] {
  const messages = readMessages();
  messages.push(message);
  writeJson(MESSAGES_FILE, messages);
  return messages;
}

export function appendMessages(newMessages: Message[]): Message[] {
  const messages = readMessages();
  messages.push(...newMessages);
  writeJson(MESSAGES_FILE, messages);
  return messages;
}

// ---------------------------------------------------------------------------
// Decisions
// ---------------------------------------------------------------------------

export function readDecisions(): Decision[] {
  return readJson<Decision[]>(DECISIONS_FILE, []);
}

export function appendDecision(decision: Decision): Decision[] {
  const decisions = readDecisions();
  decisions.push(decision);
  writeJson(DECISIONS_FILE, decisions);
  return decisions;
}

/**
 * Advances execution_status on a single decision record in-place.
 * This is the only sanctioned in-place mutation in the storage layer.
 * It is used exclusively by the HAS-AG-001 export gate to advance a
 * decision from "approved_not_executed" to "in_progress" after a
 * successful bridge file write. The updated_at timestamp is refreshed.
 *
 * Returns the full updated decisions array, or null if the decision_id
 * was not found.
 */
export function updateDecisionStatus(
  decisionId: string,
  newStatus: Decision["execution_status"],
): Decision[] | null {
  const decisions = readDecisions();
  const target = decisions.find((d) => d.decision_id === decisionId);
  if (!target) return null;
  target.execution_status = newStatus;
  target.updated_at = new Date().toISOString();
  writeJson(DECISIONS_FILE, decisions);
  return decisions;
}

/**
 * Writes an immutable markdown snapshot to the Antigravity task export
 * directory: has-data/exports/antigravity-tasks/<timestamp>-<decision-id>.md
 *
 * The file is append-only — it is never modified after creation. On successful
 * write the caller is responsible for advancing the decision's execution_status
 * to "in_progress" in decisions.json.
 *
 * Every exported file begins with a mandatory execution gate block that
 * instructs Antigravity to pause and obtain explicit operator confirmation
 * before taking any write action.
 */
export function writeAgBridgeFile(decision: Decision): string {
  assertWithinStorage(AG_TASKS_DIR);

  // -------------------------------------------------------------------------
  // Brief enforcement gate — runs BEFORE any file is written.
  // If validation fails, throw BriefEnforcementError with structured errors.
  // No partial file is written on failure.
  // -------------------------------------------------------------------------
  const enforcerResult = enforceExecutionBrief(decision);
  if (!enforcerResult.valid) {
    throw new BriefEnforcementError(
      enforcerResult.errors,
      enforcerResult.warnings,
    );
  }

  if (!fs.existsSync(AG_TASKS_DIR)) {
    fs.mkdirSync(AG_TASKS_DIR, { recursive: true });
  }

  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .slice(0, 19); // e.g. "2026-04-27T16-49-26"
  const filename = `${timestamp}-${decision.decision_id}.md`;
  const filePath = path.join(AG_TASKS_DIR, filename);
  assertWithinStorage(filePath);

  const lines: string[] = [
    `# Antigravity Task — ${decision.architectural_scope}`,
    "",
    `**Decision ID:** ${decision.decision_id}`,
    `**Project:** ${decision.project_id}`,
    `**Thread:** ${decision.thread_id}`,
    `**Source:** ${decision.source}`,
    `**Exported at:** ${new Date().toISOString()}`,
    "",
    // -----------------------------------------------------------------------
    // Execution gate — mandatory block, injected on every export.
    // Antigravity must present a plan and receive explicit operator approval
    // before taking any write action.
    // -----------------------------------------------------------------------
    "## ⚠️ Execution gate — operator confirmation required",
    "",
    "**Before modifying any files, running any commands, or taking any write",
    "action, Antigravity must:**",
    "",
    "1. Read this entire task file.",
    "2. Produce a complete implementation plan (files to change, approach, verification steps).",
    "3. Present the plan to the operator and wait for explicit approval.",
    "4. Do not proceed until the operator responds with an unambiguous confirmation.",
    "5. If the operator is not present or has not responded, do not proceed.",
    "",
    "> This gate cannot be bypassed. `SafeToAutoRun` must not be set to `true`",
    "> for any command that modifies files or state until the operator has approved",
    "> the plan above.",
    "",
    "---",
    "",
    "## Originating question",
    "",
    decision.originating_question,
    "",
    // -----------------------------------------------------------------------
    // Normalized execution brief — produced by the brief enforcer.
    // This replaces the raw accepted_proposal with a validated, structured
    // brief that contains all 10 required sections.
    // -----------------------------------------------------------------------
    "## Normalized Execution Brief",
    "",
    enforcerResult.brief,
    "",
  ];

  // Append warnings if any (advisory, non-blocking)
  if (enforcerResult.warnings.length > 0) {
    lines.push("## Enforcer Warnings", "");
    for (const w of enforcerResult.warnings) lines.push(`> ⚠️ ${w}`);
    lines.push("");
  }

  if (decision.operator_rationale) {
    lines.push("## Operator rationale", "", decision.operator_rationale, "");
  }

  if (decision.dependencies.length > 0) {
    lines.push("## Dependencies", "");
    for (const dep of decision.dependencies) lines.push(`- ${dep}`);
    lines.push("");
  }

  if (decision.constraints.length > 0) {
    lines.push("## Constraints", "");
    for (const c of decision.constraints) lines.push(`- ${c}`);
    lines.push("");
  }

  if (decision.open_questions.length > 0) {
    lines.push("## Open questions", "");
    for (const q of decision.open_questions) lines.push(`- ${q}`);
    lines.push("");
  }

  lines.push(
    "## Quality checklist",
    "",
    `- Specific enough: ${decision.decision_quality_checklist.specific_enough ? "yes" : "no"}`,
    `- In-scope identified: ${decision.decision_quality_checklist.scope_in_identified ? "yes" : "no"}`,
    `- Out-of-scope identified: ${decision.decision_quality_checklist.scope_out_identified ? "yes" : "no"}`,
    `- Dependencies captured: ${decision.decision_quality_checklist.dependencies_captured ? "yes" : "no"}`,
    `- Ready for execution: ${decision.decision_quality_checklist.ready_for_execution ? "yes" : "no"}`,
  );
  if (decision.decision_quality_checklist.notes) {
    lines.push(`- Notes: ${decision.decision_quality_checklist.notes}`);
  }
  lines.push("");

  fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
  return filePath;
}


// ---------------------------------------------------------------------------
// Threads
// ---------------------------------------------------------------------------

export function readThreads(): Thread[] {
  return readJson<Thread[]>(THREADS_FILE, []);
}

export function updateThreadActivity(threadId: string, timestamp: string): void {
  const threads = readThreads();
  const thread = threads.find((t) => t.thread_id === threadId);
  if (thread) {
    thread.last_activity_at = timestamp;
    writeJson(THREADS_FILE, threads);
  }
}

// ---------------------------------------------------------------------------
// Project context
// ---------------------------------------------------------------------------

export function readProjectContext(): ProjectContext | null {
  return readJson<ProjectContext | null>(PROJECT_CONTEXT_FILE, null);
}

// ---------------------------------------------------------------------------
// Markdown export
// ---------------------------------------------------------------------------

/**
 * Regenerates exports/decisions.md from the canonical decisions.json store.
 * The markdown file is overwritten in full rather than appended to, so that
 * it always reflects the canonical state of decisions.json. This avoids the
 * consistency risk of maintaining two parallel write paths.
 */
export function regenerateDecisionsMarkdown(): void {
  assertWithinStorage(DECISIONS_MD_FILE);
  const decisions = readDecisions();

  if (decisions.length === 0) {
    fs.writeFileSync(
      DECISIONS_MD_FILE,
      "# Decision Log\n\nNo decisions captured yet.\n",
      "utf-8",
    );
    return;
  }

  const lines: string[] = ["# Decision Log", ""];

  for (const d of decisions) {
    lines.push(`## ${d.decision_id} — ${d.architectural_scope || "decision"}`);
    lines.push("");
    lines.push(`**Created:** ${d.created_at}`);
    lines.push(`**Source:** ${d.source}`);
    lines.push(`**Execution status:** ${d.execution_status}`);
    lines.push(
      `**Downstream task ready:** ${d.downstream_task_ready ? "yes" : "no"}`,
    );
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
    lines.push(
      `- In-scope identified: ${c.scope_in_identified ? "yes" : "no"}`,
    );
    lines.push(
      `- Out-of-scope identified: ${c.scope_out_identified ? "yes" : "no"}`,
    );
    lines.push(
      `- Dependencies captured: ${c.dependencies_captured ? "yes" : "no"}`,
    );
    lines.push(
      `- Ready for execution: ${c.ready_for_execution ? "yes" : "no"}`,
    );
    if (c.notes) {
      lines.push(`- Notes: ${c.notes}`);
    }
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  fs.writeFileSync(DECISIONS_MD_FILE, lines.join("\n"), "utf-8");
}
