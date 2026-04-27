// src/lib/dummy-responses.ts
//
// Phase One produces hardcoded dummy responses for each of the three model
// roles instead of real API calls. The responses are written in markdown and
// each carries a distinct handoff_note so that the rendering path for that
// field is exercised before Phase Two integrates real providers.
//
// These responses are intentionally generic but plausibly shaped like what
// each role would produce, so that the synthesis flow can be exercised
// meaningfully during Phase One validation.

import type { Message } from "@/types/schema";

interface DummyResponseSeed {
  role: "chatgpt" | "gemini" | "claude";
  specialization:
    | "systems_architect"
    | "implementation_strategist"
    | "reviewer_synthesizer";
  provider: "openai" | "google" | "anthropic";
  model: string;
  body_markdown: string;
  handoff_note: string;
}

function randomId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

const DUMMY_SEEDS: DummyResponseSeed[] = [
  {
    role: "chatgpt",
    specialization: "systems_architect",
    provider: "openai",
    model: "gpt-4o",
    body_markdown: [
      "**Systems Architect — structural proposal**",
      "",
      "This is a Phase One dummy response standing in for the systems architect role.",
      "",
      "Decompose the question into the following structural components:",
      "",
      "1. The component or subsystem the question primarily concerns.",
      "2. The interfaces it exposes to adjacent components.",
      "3. The dependencies it relies upon.",
      "4. The constraints that must hold across all of the above.",
      "",
      "Once real provider integration is in place in Phase Two, this slot will receive an actual architectural decomposition rather than this stub.",
    ].join("\n"),
    handoff_note:
      "Strategist: focus on minimum viable build path for the components above. Reviewer: check the in-scope/out-of-scope split.",
  },
  {
    role: "gemini",
    specialization: "implementation_strategist",
    provider: "google",
    model: "gemini-1.5-pro",
    body_markdown: [
      "**Implementation Strategist — build path proposal**",
      "",
      "This is a Phase One dummy response standing in for the implementation strategist role.",
      "",
      "Recommended build path:",
      "",
      "- Phase A: scaffold the smallest end-to-end loop with hardcoded values.",
      "- Phase B: substitute real inputs/outputs without changing the loop shape.",
      "- Phase C: address polish, latency, and error visibility.",
      "",
      "Anticipated friction: latency variance across providers, markdown rendering, and operator fatigue from the capture flow.",
      "",
      "Phase Two will replace this stub with a real toolchain-aware sequencing proposal.",
    ].join("\n"),
    handoff_note:
      "Architect: confirm the loop shape above matches the schema boundaries. Reviewer: flag any hidden assumptions about operator behavior.",
  },
  {
    role: "claude",
    specialization: "reviewer_synthesizer",
    provider: "anthropic",
    model: "claude-3-5-sonnet",
    body_markdown: [
      "**Reviewer and Synthesizer — critique and synthesis**",
      "",
      "This is a Phase One dummy response standing in for the reviewer and synthesizer role.",
      "",
      "Hidden assumptions worth surfacing:",
      "",
      "- The operator will engage with the capture flow under realistic conditions, not just first-use conditions.",
      "- The three roles will produce genuinely complementary responses rather than overlapping ones.",
      "- The decision quality checklist will not be bypassed under time pressure.",
      "",
      "Synthesized recommendation: proceed with the architect's structural framing and the strategist's phased build path, monitoring the assumptions above during validation.",
      "",
      "Phase Two will replace this stub with a real critique-and-synthesis response grounded in the actual architect and strategist outputs.",
    ].join("\n"),
    handoff_note:
      "Operator: when capturing a decision from this thread, take particular care with the in-scope and out-of-scope checklist items.",
  },
];

/**
 * Produces three Message records (one per role) representing dummy responses
 * to the operator's question. The caller is responsible for persisting them.
 */
export function buildDummyResponses(args: {
  thread_id: string;
  project_id: string;
  parent_message_id: string;
  timestamp: string;
}): Message[] {
  return DUMMY_SEEDS.map((seed) => ({
    message_id: randomId("msg"),
    thread_id: args.thread_id,
    project_id: args.project_id,
    created_at: args.timestamp,
    role: seed.role,
    specialization: seed.specialization,
    parent_message_id: args.parent_message_id,
    body_markdown: seed.body_markdown,
    status: "proposal" as const,
    model_metadata: {
      provider: seed.provider,
      model: seed.model,
    },
    handoff_note: seed.handoff_note,
  }));
}
