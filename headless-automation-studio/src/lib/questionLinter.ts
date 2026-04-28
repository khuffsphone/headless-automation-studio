// src/lib/questionLinter.ts
//
// Pre-debate input lint for HAS-007.
//
// Accepts the operator's originating question and returns either:
//   { valid: true, warnings: string[] }
//   { valid: false, errors: LintError[], warnings: string[] }
//
// Design constraints:
//   - Deterministic. No model calls. No async.
//   - Browser-safe: no fs, path, process, or any Node-only API.
//   - Does not modify any input.
//   - Failed lint is BLOCKING (errors[]). Advisory items are WARNINGS (warnings[]).
//   - 7 rules. Count is exact.

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface LintError {
  rule_id: string;
  message: string;
  recommended_fix: string;
}

export type LintResult =
  | { valid: true; warnings: string[] }
  | { valid: false; errors: LintError[]; warnings: string[] };

// ---------------------------------------------------------------------------
// Rule helpers
// ---------------------------------------------------------------------------

/** Returns true if the text contains at least one match for the pattern. */
function has(text: string, pattern: RegExp): boolean {
  return pattern.test(text);
}

/**
 * Returns true if, within `windowChars` characters after `phraseMatch.index`,
 * any of the `concretizers` patterns appear. Used to suppress vague-phrase
 * false positives when the operator has already anchored the phrase.
 */
function isContextualized(
  text: string,
  matchIndex: number,
  matchLength: number,
  windowChars = 80,
): boolean {
  const after = text.slice(matchIndex + matchLength, matchIndex + matchLength + windowChars);
  // Concrete follow-ons: colon, "by", "to ensure", "so that", "when", "where",
  // "that passes", "that returns", a file extension, a quoted string, or a number.
  return /[:"]|by\s|to\s+ensure|so\s+that|when\s|where\s|that\s+(passes|returns|fails|succeeds)|[\w.-]+\.(ts|js|tsx|jsx|json|yml|yaml|md)|["'`]\w|=>\s*\w|\d+/.test(
    after,
  );
}

// ---------------------------------------------------------------------------
// Rule 1 — too_short
// Prompt is shorter than 20 characters; cannot contain an actionable directive.
// ---------------------------------------------------------------------------

function ruleTooShort(q: string): LintError | null {
  if (q.length < 20) {
    return {
      rule_id: "too_short",
      message: `The prompt is too short to be actionable (${q.length} characters). HAS cannot produce useful synthesis from a one-line stub.`,
      recommended_fix:
        "Expand the prompt to include: what you are deciding, the current state of the system, and what a good answer would address.",
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Rule 2 — vague_phrase
// Prompt contains a vague quality word without a concrete anchor.
// The 10 phrases from the HAS-007 spec. Each is checked with context.
// ---------------------------------------------------------------------------

const VAGUE_PHRASES: Array<{ phrase: string; pattern: RegExp }> = [
  { phrase: "production-ready", pattern: /\bproduction[\s-]ready\b/i },
  { phrase: "modernize",        pattern: /\bmodernize\b/i },
  { phrase: "best practices",   pattern: /\bbest\s+practices?\b/i },
  { phrase: "improve",          pattern: /\bimprove\b/i },
  { phrase: "enhance",          pattern: /\benhance\b/i },
  { phrase: "optimize",         pattern: /\boptimize\b/i },
  { phrase: "robust",           pattern: /\brobust\b/i },
  { phrase: "comprehensive",    pattern: /\bcomprehensive\b/i },
  { phrase: "end-to-end",       pattern: /\bend[\s-]to[\s-]end\b/i },
  { phrase: "full pipeline",    pattern: /\bfull\s+pipeline\b/i },
];

function ruleVaguePhrase(q: string): LintError | null {
  for (const { phrase, pattern } of VAGUE_PHRASES) {
    const match = pattern.exec(q);
    if (match !== null) {
      if (!isContextualized(q, match.index, match[0].length)) {
        return {
          rule_id: "vague_phrase",
          message: `The prompt uses '${phrase}' without defining what that means in this context.`,
          recommended_fix: `Replace '${phrase}' with a concrete, testable condition. For example: instead of 'production-ready', write 'build passes, all tests pass, and the export gate accepts the decision'. Anchor the phrase to a specific outcome.`,
        };
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Rule 3 — multi_objective
// Prompt contains two or more independent imperative clauses joined by " and ".
// ---------------------------------------------------------------------------

const IMPERATIVE_VERBS =
  "implement|build|create|add|write|refactor|remove|fix|update|integrate|deploy|migrate|replace|rewrite|convert|move|extract|introduce|enable|disable|generate|scaffold";

const MULTI_OBJECTIVE_PATTERN = new RegExp(
  `\\b(${IMPERATIVE_VERBS})\\b.{3,80}\\band\\b.{1,60}\\b(${IMPERATIVE_VERBS})\\b`,
  "i",
);

function ruleMultiObjective(q: string): LintError | null {
  if (MULTI_OBJECTIVE_PATTERN.test(q)) {
    return {
      rule_id: "multi_objective",
      message:
        "The prompt appears to contain multiple bounded objectives joined by 'and'. Each HAS question should address a single decision.",
      recommended_fix:
        "Split this into two separate questions. Pose the first to the room now, accept a decision, then pose the second. Multi-objective prompts produce fragmented synthesis that is hard to act on.",
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Rule 4 — implementation_no_criteria
// Prompt uses implementation language but contains no acceptance-criteria signal.
// ---------------------------------------------------------------------------

const IMPL_VERBS = /\b(implement|build|create|add|write)\b/i;
const CRITERIA_SIGNALS =
  /\b(should|must|passes?|returns?|criterion|criteria|accept|assert|verify|validate|test|check|ensure|guarantee|confirm|expect)\b/i;
const CHECKLIST_PATTERN = /- \[[ x]\]/;

function ruleImplementationNoCriteria(q: string): LintError | null {
  if (has(q, IMPL_VERBS) && !has(q, CRITERIA_SIGNALS) && !CHECKLIST_PATTERN.test(q)) {
    return {
      rule_id: "implementation_no_criteria",
      message:
        "The prompt asks for implementation but contains no acceptance-criteria signal (no 'should', 'must', 'passes', 'returns', 'validates', or similar).",
      recommended_fix:
        "Add at least one acceptance criterion. Example: 'The function must return X when given Y' or 'The build must pass after this change'. Without criteria, the debate room cannot evaluate whether a proposal is correct.",
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Rule 5 — execution_no_boundary
// Prompt uses execution language but contains no out-of-scope boundary signal.
// ---------------------------------------------------------------------------

const EXEC_VERBS = /\b(implement|build|deploy|run|execute|perform|deliver|ship)\b/i;
const BOUNDARY_SIGNALS =
  /\b(do\s+not|don't|out[\s-]of[\s-]scope|only|except|exclude|not\s+include|without|skip|ignore|leave\s+out|defer|deferred)\b/i;

function ruleExecutionNoBoundary(q: string): LintError | null {
  if (has(q, EXEC_VERBS) && !has(q, BOUNDARY_SIGNALS)) {
    return {
      rule_id: "execution_no_boundary",
      message:
        "The prompt asks for execution but contains no out-of-scope boundary. Without a boundary, the debate room will speculate about what is and is not included.",
      recommended_fix:
        "Add an explicit boundary. Example: 'Do not modify game source files', 'Only change the CI workflow', or 'Exclude deployment and coverage thresholds'. This prevents scope creep in the synthesis.",
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Rule 6 — agent_ambiguity
// Prompt references agent/automation/integration/workflow without stating
// whether the task is planning-only or code-changing.
// ---------------------------------------------------------------------------

const AGENT_WORDS = /\b(agent|automation|integration|workflow)\b/i;
const PLANNING_QUALIFIERS =
  /\b(planning[\s-]only|planning\s+only|code[\s-]changing|no[\s-]code|no\s+code|design\s+only|read[\s-]only|read\s+only|no\s+writes?|no\s+changes?|spec\s+only|documentation\s+only|review\s+only|analysis\s+only)\b/i;

function ruleAgentAmbiguity(q: string): LintError | null {
  if (has(q, AGENT_WORDS) && !has(q, PLANNING_QUALIFIERS)) {
    return {
      rule_id: "agent_ambiguity",
      message:
        "The prompt references 'agent', 'automation', 'integration', or 'workflow' without specifying whether this task is planning-only or code-changing.",
      recommended_fix:
        "Add a qualifier such as 'planning-only', 'no code changes', or 'code-changing'. Example: 'Should we add a GitHub Actions workflow (code-changing)?' or 'Design the agent architecture (planning-only, no implementation).'",
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Rule 7 — scope_too_broad
// Prompt uses scope-maximizing language without a bounded deliverable.
// ---------------------------------------------------------------------------

const BROAD_SCOPE_WORDS =
  /\b(everything|entire(?:\s+\w+){0,2}|whole\s+\w+|complete\s+rewrite|all\s+of\s+the|full\s+system|every\s+\w+|all\s+\w+\s+features?|end[\s-]to[\s-]end\s+overhaul)\b/i;
const BOUNDED_DELIVERABLE =
  /(?:[\w/-]+\.(?:ts|tsx|js|jsx|json|yml|yaml|md)|`[^`]+`|"[^"]+"|in\s+\w+\.(?:ts|js)|\bone\s+file\b|\bsingle\s+\w+\b|\bonly\s+\w+\.(?:ts|js))/i;

function ruleScopeTooBoard(q: string): LintError | null {
  if (has(q, BROAD_SCOPE_WORDS) && !has(q, BOUNDED_DELIVERABLE)) {
    return {
      rule_id: "scope_too_broad",
      message:
        "The prompt uses scope-maximizing language ('entire', 'everything', 'whole', 'complete rewrite', etc.) without identifying a bounded deliverable.",
      recommended_fix:
        "Replace the broad scope word with a specific, bounded deliverable. Example: instead of 'refactor the entire codebase', write 'refactor src/lib/storage.ts to extract the markdown export logic into a separate module'.",
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Ordered rule pipeline (7 rules)
// ---------------------------------------------------------------------------

type Rule = (q: string) => LintError | null;

const RULES: Rule[] = [
  ruleTooShort,               // 1
  ruleVaguePhrase,            // 2
  ruleMultiObjective,         // 3
  ruleImplementationNoCriteria, // 4
  ruleExecutionNoBoundary,    // 5
  ruleAgentAmbiguity,         // 6
  ruleScopeTooBoard,          // 7
];

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Lints the operator's originating question.
 *
 * Returns { valid: true, warnings } if the question passes all blocking rules.
 * Returns { valid: false, errors, warnings } if any blocking rule fires.
 *
 * This function is:
 *   - Pure: no I/O, no side effects
 *   - Deterministic: same input always produces same output
 *   - Browser-safe: no Node-only APIs
 *   - Synchronous: no async/await
 */
export function lintQuestion(question: string): LintResult {
  const trimmed = question.trim();
  const errors: LintError[] = [];
  const warnings: string[] = [];

  for (const rule of RULES) {
    const error = rule(trimmed);
    if (error !== null) {
      errors.push(error);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  return { valid: true, warnings };
}
