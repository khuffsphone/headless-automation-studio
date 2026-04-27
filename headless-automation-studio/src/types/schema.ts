// src/types/schema.ts
//
// Headless Automation Studio v0.1 — Layer One
// Single source of truth for persistent data shapes.
//
// These interfaces match the Layer One Technical Design Document, Revision 2,
// in full. Phase One does not exercise every field, but every field is
// declared here so that Phase Two and later expansions do not require a
// schema migration.

// ---------------------------------------------------------------------------
// Message
// ---------------------------------------------------------------------------
//
// One record per turn in the room: operator questions, model responses, and
// system events such as provider failures. Append-only in messages.json.

export type MessageRole =
  | "operator"
  | "chatgpt"
  | "gemini"
  | "claude"
  | "system";

export type MessageSpecialization =
  | "operator"
  | "systems_architect"
  | "implementation_strategist"
  | "reviewer_synthesizer"
  | "system";

export type MessageStatus =
  | "neutral"
  | "proposal"
  | "accepted_decision"
  | "rejected_proposal"
  | "provider_failure";

export interface ModelMetadata {
  provider: "openai" | "google" | "anthropic" | "system";
  model: string;
}

export interface Message {
  message_id: string;
  thread_id: string;
  project_id: string;
  created_at: string; // ISO 8601 with timezone
  role: MessageRole;
  specialization: MessageSpecialization;
  parent_message_id?: string;
  body_markdown: string;
  status: MessageStatus;
  model_metadata?: ModelMetadata;
  /**
   * Optional targeted note from the producing role to a downstream role.
   * Phase One dummy responses populate this so the rendering path is
   * exercised before real model integration in Phase Two.
   */
  handoff_note?: string;
}

// ---------------------------------------------------------------------------
// Decision
// ---------------------------------------------------------------------------
//
// Append-only canonical record of every accepted decision. This is the
// primary output of Layer One and the primary input of the future Layer Two
// execution bridge. Schema completeness here is the project's main defense
// against decision quality decay.

export type DecisionSource =
  | "chatgpt"
  | "gemini"
  | "claude"
  | "operator"
  | "synthesized";

export type ExecutionStatus =
  | "approved_not_executed"
  | "in_progress"
  | "executed"
  | "superseded";

export interface RejectedAlternative {
  source: DecisionSource;
  summary: string;
  reason_rejected: string;
}

/**
 * Operator-supplied responses to the five mandatory quality prompts.
 * The fifth prompt (`ready_for_execution`) determines the value of
 * Decision.downstream_task_ready in the parent record.
 */
export interface DecisionQualityChecklist {
  /** Specific enough to be understood later without the surrounding chat? */
  specific_enough: boolean;
  /** Does the decision identify what is in scope? */
  scope_in_identified: boolean;
  /** Does the decision identify what is out of scope? */
  scope_out_identified: boolean;
  /** Are dependencies or blockers captured? */
  dependencies_captured: boolean;
  /** Ready for downstream execution, or planning-only? */
  ready_for_execution: boolean;
  /** Optional free-text note from the operator about the assessment. */
  notes?: string;
}

export interface Decision {
  decision_id: string;
  project_id: string;
  thread_id: string;
  originating_question: string;
  accepted_proposal: string;
  source: DecisionSource;
  rejected_alternatives: RejectedAlternative[];
  operator_rationale?: string;
  architectural_scope: string;
  execution_status: ExecutionStatus;
  /**
   * Phase One: boolean.
   * Future migration: this field may become an enumerated type with values
   * such as "ready", "blocked_on_dependency", "blocked_on_clarification",
   * and "deferred". Any tooling that reads this field should anticipate
   * the migration.
   */
  downstream_task_ready: boolean;
  dependencies: string[];
  constraints: string[];
  open_questions: string[];
  decision_quality_checklist: DecisionQualityChecklist;
  created_at: string; // ISO 8601 with timezone
  updated_at: string; // ISO 8601 with timezone
}

// ---------------------------------------------------------------------------
// ProjectContext
// ---------------------------------------------------------------------------
//
// Single document per project. Injected verbatim into every prompt envelope
// in Phase Two. Operator is responsible for keeping it current.

export interface ProjectContext {
  project_id: string;
  project_name: string;
  description: string;
  objectives: string[];
  constraints: string[];
  settled_decisions: string[];
  open_questions: string[];
  last_updated: string; // ISO 8601 with timezone
}

// ---------------------------------------------------------------------------
// Thread
// ---------------------------------------------------------------------------
//
// Threads organize messages and decisions into lines of inquiry. Phase One
// uses a single active thread, but the schema supports multiple from the
// outset to avoid a migration later.

export type ThreadStatus = "active" | "resolved" | "abandoned";

export interface Thread {
  thread_id: string;
  project_id: string;
  title: string;
  created_at: string;
  last_activity_at: string;
  status: ThreadStatus;
  summary?: string;
}
