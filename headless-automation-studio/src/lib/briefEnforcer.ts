// src/lib/briefEnforcer.ts
//
// Post-debate execution-brief template enforcer.
//
// Accepts a Decision record and returns either a normalized execution brief
// string ready for export, or a structured list of validation errors explaining
// exactly which required sections are missing or materially vague.
//
// Design constraints (per HAS-006):
//   - Deterministic. No model calls.
//   - Pure function. No file I/O. No side effects.
//   - Does not mutate the incoming Decision record.
//   - `source` field does NOT satisfy the Role requirement.
//   - Quality checklist booleans do NOT satisfy Acceptance Criteria.
//   - `ready_for_execution: true` does NOT satisfy Walkthrough Artifact Requirement.
//   - All 10 required sections must be explicitly present in the normalized brief.

import type { Decision } from "@/types/schema";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface BriefValidationError {
  section: string;
  message: string;
}

export type BriefEnforcerResult =
  | { valid: true; brief: string; warnings: string[] }
  | { valid: false; errors: BriefValidationError[]; warnings: string[] };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Phrases that count as empty/placeholder content. */
const VAGUE_PATTERNS = [
  /^\s*tbd\s*$/i,
  /^\s*n\/a\s*$/i,
  /^\s*\[\.{3}\]\s*$/,
  /^\s*\[.*\]\s*$/,
  /^\s*todo\s*$/i,
  /^\s*none\s*$/i,
  /^\s*-\s*$/,
];

function isVague(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 8) return true;
  return VAGUE_PATTERNS.some((p) => p.test(trimmed));
}

/**
 * Extracts the content block that follows a given heading in a markdown string.
 * Heading matching is case-insensitive and allows ## or ### prefix.
 * Returns null if the heading is not found.
 * Returns an empty string if the heading is found but the block is empty.
 */
function extractSection(markdown: string, headingText: string): string | null {
  const lines = markdown.split("\n");
  const headingPattern = new RegExp(
    `^#{1,6}\\s+${headingText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`,
    "i",
  );

  let foundAt = -1;
  for (let i = 0; i < lines.length; i++) {
    if (headingPattern.test(lines[i].trim())) {
      foundAt = i;
      break;
    }
  }

  if (foundAt === -1) return null;

  // Collect content until the next heading of equal or higher level
  const headingLevel = (lines[foundAt].match(/^(#{1,6})/) ?? ["", ""])[1]
    .length;
  const contentLines: string[] = [];
  for (let i = foundAt + 1; i < lines.length; i++) {
    const levelMatch = lines[i].match(/^(#{1,6})\s/);
    if (levelMatch && levelMatch[1].length <= headingLevel) break;
    contentLines.push(lines[i]);
  }

  return contentLines.join("\n").trim();
}

/** Returns true if the text contains at least one markdown checkbox line. */
function hasCheckboxItems(text: string): boolean {
  return /^- \[[ x]\]/im.test(text);
}

/** Returns true if the text contains at least one fenced code block or a line starting with a command-like pattern. */
function hasCommandContent(text: string): boolean {
  return /```/.test(text) || /^\s*(npm|npx|node|git|tsc|vitest|pnpm|yarn)\b/im.test(text);
}

// ---------------------------------------------------------------------------
// Section validators
// ---------------------------------------------------------------------------
// Each validator receives the full proposal text and the Decision record, and
// returns an error message string if the section is missing/vague, or null if
// the section is present and sufficiently substantive.

type SectionValidator = (
  proposal: string,
  decision: Decision,
) => BriefValidationError | null;

/**
 * Section 1 — Role
 * Must be an explicit heading with actual execution-role content.
 * The Decision.source field does NOT satisfy this requirement.
 */
function validateRole(
  proposal: string,
  _decision: Decision,
): BriefValidationError | null {
  const content = extractSection(proposal, "Role");
  if (content === null) {
    return {
      section: "Role",
      message:
        "Missing required '## Role' section. The exported brief must state a specific execution role (e.g. 'Senior TypeScript engineer'). The `source` field is not a substitute.",
    };
  }
  if (isVague(content)) {
    return {
      section: "Role",
      message:
        "'## Role' section is present but empty or vague. Provide a concrete execution role description.",
    };
  }
  return null;
}

/**
 * Section 2 — Objective
 * Must be an explicit heading with a single bounded objective statement.
 */
function validateObjective(
  proposal: string,
  decision: Decision,
): BriefValidationError | null {
  const content = extractSection(proposal, "Objective");
  if (content === null) {
    return {
      section: "Objective",
      message:
        "Missing required '## Objective' section. The originating question alone is insufficient — the brief must state a single bounded implementation objective.",
    };
  }
  if (isVague(content) || content.trim().length < 20) {
    return {
      section: "Objective",
      message: `'## Objective' section is too brief or vague (${content.trim().length} chars). Provide a concrete, bounded objective statement.`,
    };
  }
  // Suppress unused-variable warning
  void decision;
  return null;
}

/**
 * Section 3 — Hard Scope Boundary
 * Must be an explicit heading. The constraints array alone is not sufficient
 * if the heading is absent (constraints are not surfaced to Antigravity in the
 * proposal body without the heading).
 */
function validateHardScopeBoundary(
  proposal: string,
  decision: Decision,
): BriefValidationError | null {
  const aliases = [
    "Hard Scope Boundary",
    "Scope Boundary",
    "Hard Scope",
    "Scope",
  ];
  for (const alias of aliases) {
    const content = extractSection(proposal, alias);
    if (content !== null) {
      if (isVague(content)) {
        return {
          section: "Hard Scope Boundary",
          message:
            "'## Hard Scope Boundary' section is present but empty or vague. State explicitly what this task is and is not.",
        };
      }
      return null;
    }
  }
  // Fall back: check constraints array as supporting evidence, but still require heading
  if (decision.constraints.length > 0) {
    return {
      section: "Hard Scope Boundary",
      message:
        "Missing '## Hard Scope Boundary' heading in the proposal. Constraints are captured in the decision record but must also appear as an explicit section in the exported brief.",
    };
  }
  return {
    section: "Hard Scope Boundary",
    message:
      "Missing required '## Hard Scope Boundary' section and no constraints defined. State what this task is and is not.",
  };
}

/**
 * Section 4 — Execution Gate
 * This section is always injected by writeAgBridgeFile. The enforcer
 * validates that the proposal at minimum acknowledges inspect-before-write
 * intent, but does not block on its absence since the gate is added at
 * export time.
 */
function validateExecutionGate(
  proposal: string,
  _decision: Decision,
): BriefValidationError | null {
  // The gate is injected at export time — this is an advisory check only.
  const keywords = ["inspect", "before", "write", "confirm", "gate"];
  const lower = proposal.toLowerCase();
  const missing = keywords.filter((k) => !lower.includes(k));
  if (missing.length >= 4) {
    return {
      section: "Execution Gate",
      message:
        "The proposal does not reference an inspect-before-write gate. The enforcer will inject the standard gate at export time, but the proposal should acknowledge it to avoid drift.",
    };
  }
  return null;
}

/**
 * Section 5 — Implementation Requirements
 * Must be an explicit heading with substantive content.
 */
function validateImplementationRequirements(
  proposal: string,
  _decision: Decision,
): BriefValidationError | null {
  const aliases = ["Implementation Requirements", "Requirements", "Implementation"];
  for (const alias of aliases) {
    const content = extractSection(proposal, alias);
    if (content !== null) {
      if (content.trim().length < 30) {
        return {
          section: "Implementation Requirements",
          message:
            "'## Implementation Requirements' section is too brief. Provide concrete, implementable requirements.",
        };
      }
      return null;
    }
  }
  return {
    section: "Implementation Requirements",
    message:
      "Missing required '## Implementation Requirements' section. List concrete implementation requirements that Antigravity can execute against.",
  };
}

/**
 * Section 6 — Acceptance Criteria
 * Must be an explicit heading with at least one markdown checkbox item.
 * The DecisionQualityChecklist booleans do NOT satisfy this requirement.
 */
function validateAcceptanceCriteria(
  proposal: string,
  _decision: Decision,
): BriefValidationError | null {
  const aliases = ["Acceptance Criteria", "Criteria", "Acceptance"];
  for (const alias of aliases) {
    const content = extractSection(proposal, alias);
    if (content !== null) {
      if (!hasCheckboxItems(content)) {
        return {
          section: "Acceptance Criteria",
          message:
            "'## Acceptance Criteria' section is present but contains no checkbox items (`- [ ] ...`). Each criterion must be a discrete, testable checkbox. The quality checklist is not a substitute.",
        };
      }
      return null;
    }
  }
  return {
    section: "Acceptance Criteria",
    message:
      "Missing required '## Acceptance Criteria' section with checkbox items (`- [ ] ...`). The DecisionQualityChecklist boolean fields do not satisfy this requirement.",
  };
}

/**
 * Section 7 — Explicit Out-of-Scope
 * Must be an explicit heading with at least one listed item.
 */
function validateExplicitOutOfScope(
  proposal: string,
  decision: Decision,
): BriefValidationError | null {
  const aliases = [
    "Explicit Out-of-Scope",
    "Out-of-Scope",
    "Out of Scope",
    "Not in Scope",
    "Excluded",
  ];
  for (const alias of aliases) {
    const content = extractSection(proposal, alias);
    if (content !== null) {
      if (isVague(content) || !content.includes("-")) {
        return {
          section: "Explicit Out-of-Scope",
          message:
            "'## Explicit Out-of-Scope' section is present but has no list items. Each excluded item must be a separate line starting with `-`.",
        };
      }
      return null;
    }
  }
  if (decision.constraints.length > 0 && decision.decision_quality_checklist.scope_out_identified) {
    return {
      section: "Explicit Out-of-Scope",
      message:
        "Missing '## Explicit Out-of-Scope' heading in the proposal. Out-of-scope items are captured in constraints but must appear as an explicit section in the exported brief.",
    };
  }
  return {
    section: "Explicit Out-of-Scope",
    message:
      "Missing required '## Explicit Out-of-Scope' section. List at least one item that is explicitly excluded from this task.",
  };
}

/**
 * Section 8 — Expected Output
 * Must be an explicit heading with a numbered or bulleted list of deliverables.
 */
function validateExpectedOutput(
  proposal: string,
  _decision: Decision,
): BriefValidationError | null {
  const aliases = ["Expected Output", "Output", "Deliverables", "Return"];
  for (const alias of aliases) {
    const content = extractSection(proposal, alias);
    if (content !== null) {
      if (content.trim().length < 20) {
        return {
          section: "Expected Output",
          message:
            "'## Expected Output' section is too brief. List the concrete deliverables Antigravity must return.",
        };
      }
      return null;
    }
  }
  return {
    section: "Expected Output",
    message:
      "Missing required '## Expected Output' section. Specify what Antigravity must return (files changed, commands run, test results, etc.).",
  };
}

/**
 * Section 9 — Verification Commands / Manual Checks
 * Must be an explicit heading with at least one command or manual check listed.
 */
function validateVerification(
  proposal: string,
  _decision: Decision,
): BriefValidationError | null {
  const aliases = [
    "Verification Commands",
    "Verification",
    "Manual Checks",
    "Commands to Run",
    "Commands",
    "Verification Commands / Manual Checks",
  ];
  for (const alias of aliases) {
    const content = extractSection(proposal, alias);
    if (content !== null) {
      if (!hasCommandContent(content) && content.trim().length < 15) {
        return {
          section: "Verification",
          message:
            "'## Verification' section is present but contains no commands or manual check steps. Provide at least one runnable command or explicit manual verification step.",
        };
      }
      return null;
    }
  }
  return {
    section: "Verification",
    message:
      "Missing required '## Verification Commands / Manual Checks' section. Provide at least one command or explicit manual verification step.",
  };
}

/**
 * Section 10 — Walkthrough Artifact Requirement
 * Must be an explicit heading stating what the walkthrough must contain.
 * `ready_for_execution: true` alone does NOT satisfy this requirement.
 */
function validateWalkthroughArtifact(
  proposal: string,
  _decision: Decision,
): BriefValidationError | null {
  const aliases = [
    "Walkthrough Artifact",
    "Walkthrough Artifact Requirement",
    "Walkthrough",
    "Artifact Requirement",
  ];
  for (const alias of aliases) {
    const content = extractSection(proposal, alias);
    if (content !== null) {
      if (isVague(content) || content.trim().length < 15) {
        return {
          section: "Walkthrough Artifact Requirement",
          message:
            "'## Walkthrough Artifact Requirement' section is present but too vague. State the path convention and what the walkthrough must contain.",
        };
      }
      return null;
    }
  }
  return {
    section: "Walkthrough Artifact Requirement",
    message:
      "Missing required '## Walkthrough Artifact Requirement' section. `ready_for_execution: true` does not satisfy this requirement. The brief must explicitly state what walkthrough artifact Antigravity must produce and what it must contain.",
  };
}

// ---------------------------------------------------------------------------
// Ordered validator pipeline
// ---------------------------------------------------------------------------

const VALIDATORS: SectionValidator[] = [
  validateRole,                       // 1
  validateObjective,                  // 2
  validateHardScopeBoundary,          // 3
  validateExecutionGate,              // 4 — advisory
  validateImplementationRequirements, // 5
  validateAcceptanceCriteria,         // 6
  validateExplicitOutOfScope,         // 7
  validateExpectedOutput,             // 8
  validateVerification,               // 9
  validateWalkthroughArtifact,        // 10
];

// ---------------------------------------------------------------------------
// Brief normalizer
// ---------------------------------------------------------------------------
// Builds the normalized execution brief from the decision record. Sections
// that are already present in the proposal are used as-is. Missing optional
// sections are generated deterministically from the structured decision fields.
// The Execution Gate block is always injected by writeAgBridgeFile — we do
// not duplicate it here.

function buildNormalizedBrief(decision: Decision): string {
  const p = decision.accepted_proposal;
  const lines: string[] = [];

  // Helper: use existing section if present, otherwise generate from fields.
  function section(
    heading: string,
    aliases: string[],
    fallback: () => string,
  ): void {
    for (const alias of [heading, ...aliases]) {
      const content = extractSection(p, alias);
      if (content !== null && !isVague(content)) {
        lines.push(`## ${heading}`, "", content, "");
        return;
      }
    }
    lines.push(`## ${heading}`, "", fallback(), "");
  }

  // 1 — Role (must come from proposal; no fallback from `source`)
  section("Role", [], () => {
    // This fallback is only reached if the validator passed — which requires
    // a non-vague Role section. If we get here the proposal has one; the
    // fallback is a safety net that should never fire.
    return `[Role not specified — enforcement should have caught this]`;
  });

  // 2 — Objective
  section("Objective", [], () => decision.originating_question);

  // 3 — Hard Scope Boundary
  section("Hard Scope Boundary", ["Scope Boundary", "Hard Scope", "Scope"], () => {
    if (decision.constraints.length > 0) {
      return decision.constraints.map((c) => `- ${c}`).join("\n");
    }
    return "[No scope boundary defined]";
  });

  // 4 — Execution Gate (injected by writeAgBridgeFile — noted here for structure)
  lines.push(
    "## Execution Gate — Inspect Before Write",
    "",
    "Before making changes, inspect the repository and return:",
    "1. Current implementation summary",
    "2. Files likely to be touched",
    "3. Commands/tests to run",
    "4. Risks",
    "5. Out-of-scope items",
    "6. Confirmation request",
    "",
  );

  // 5 — Implementation Requirements
  section(
    "Implementation Requirements",
    ["Requirements", "Implementation"],
    () => decision.accepted_proposal,
  );

  // 6 — Acceptance Criteria (must come from proposal with checkboxes)
  section("Acceptance Criteria", ["Criteria", "Acceptance"], () => {
    // Fallback: derive from quality checklist fields as a minimum scaffold
    return [
      "- [ ] [Acceptance criteria not specified — add testable criteria]",
    ].join("\n");
  });

  // 7 — Explicit Out-of-Scope
  section(
    "Explicit Out-of-Scope",
    ["Out-of-Scope", "Out of Scope", "Not in Scope", "Excluded"],
    () => {
      if (decision.constraints.length > 0) {
        return decision.constraints.map((c) => `- ${c}`).join("\n");
      }
      return "- [No explicit out-of-scope items defined]";
    },
  );

  // 8 — Expected Output
  section("Expected Output", ["Output", "Deliverables", "Return"], () =>
    [
      "Return:",
      "1. Files changed",
      "2. Summary of changes",
      "3. Commands run",
      "4. Test/build results",
      "5. Known limitations",
      "6. Walkthrough artifact path",
    ].join("\n"),
  );

  // 9 — Verification
  section(
    "Verification Commands / Manual Checks",
    [
      "Verification Commands",
      "Verification",
      "Manual Checks",
      "Commands to Run",
      "Commands",
    ],
    () => {
      const cmds = decision.constraints
        .filter((c) => /^(npm|npx|node|git|tsc|vitest)\b/.test(c.trim()))
        .map((c) => `\`${c}\``)
        .join("\n");
      return cmds || "- [ ] Manually verify changes in browser or via test run";
    },
  );

  // 10 — Walkthrough Artifact Requirement
  section(
    "Walkthrough Artifact Requirement",
    ["Walkthrough Artifact", "Walkthrough", "Artifact Requirement"],
    () =>
      [
        "After completing this task, produce a walkthrough artifact at:",
        "",
        "`docs/walkthrough-[TASK-ID].md`",
        "",
        "The walkthrough must include:",
        "- Summary of changes made",
        "- Files modified and why",
        "- Commands run and their output",
        "- Test/build results",
        "- Any known limitations or follow-up items",
      ].join("\n"),
  );

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Validates a Decision record against the 10-section execution-brief template
 * and returns either a normalized brief string or structured validation errors.
 *
 * This function is pure: it reads from the Decision record and returns a value.
 * It does not write files, make network calls, or call any LLM.
 */
export function enforceExecutionBrief(
  decision: Decision,
): BriefEnforcerResult {
  const errors: BriefValidationError[] = [];
  const warnings: string[] = [];

  for (const validator of VALIDATORS) {
    const result = validator(decision.accepted_proposal, decision);
    if (result !== null) {
      // Section 4 (Execution Gate) is advisory — downgrade to warning
      if (result.section === "Execution Gate") {
        warnings.push(result.message);
      } else {
        errors.push(result);
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  const brief = buildNormalizedBrief(decision);
  return { valid: true, brief, warnings };
}
