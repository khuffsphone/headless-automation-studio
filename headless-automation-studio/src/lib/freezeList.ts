// src/lib/freezeList.ts
//
// HAS-008: Freeze-list loader and proposal checker.
//
// Loads has-data/freeze-list.json and checks whether an accepted proposal
// references any protected contract without an explicit acknowledgment.
//
// Design constraints:
//   - No minimatch or external dependencies. Uses a local glob-to-regex helper.
//   - schema.ts is NOT modified; all freeze-list types live here.
//   - Missing freeze-list.json is non-fatal (returns null).
//   - Malformed JSON throws FreezeListConfigError (caller surfaces as 422).
//   - Blocking unacknowledged hits throw FreezeListError (caller surfaces as 422).
//   - No partial export files are written on any failure path.

import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Types (all freeze-list types live here, not in schema.ts)
// ---------------------------------------------------------------------------

export interface FreezeListItem {
  id: string;
  label: string;
  type: "path" | "contract" | "interface";
  patterns: string[];
  reason: string;
  requires_explicit_acknowledgment: boolean;
}

export interface FreezeList {
  version: 1;
  protected_items: FreezeListItem[];
}

export interface FreezeListHit {
  item_id: string;
  item_label: string;
  matched_on: string;
  reason: string;
  requires_explicit_acknowledgment: boolean;
  acknowledged: boolean;
}

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

/**
 * Thrown when freeze-list.json exists but cannot be parsed or is structurally
 * invalid. The caller surfaces this as a 422 freeze_list_config_error.
 */
export class FreezeListConfigError extends Error {
  readonly detail: string;
  constructor(detail: string) {
    super(`Freeze-list config is invalid: ${detail}`);
    this.name = "FreezeListConfigError";
    this.detail = detail;
  }
}

/**
 * Thrown when one or more protected items are referenced in the proposal
 * without an explicit acknowledgment. The caller surfaces this as a 422
 * freeze_list_blocked response and writes no export file.
 */
export class FreezeListError extends Error {
  readonly blocking_hits: FreezeListHit[];
  readonly all_hits: FreezeListHit[];
  constructor(blocking_hits: FreezeListHit[], all_hits: FreezeListHit[]) {
    super(
      `Export blocked by freeze list (${blocking_hits.length} unacknowledged protected item${
        blocking_hits.length === 1 ? "" : "s"
      }): ${blocking_hits.map((h) => h.item_id).join(", ")}`,
    );
    this.name = "FreezeListError";
    this.blocking_hits = blocking_hits;
    this.all_hits = all_hits;
  }
}

// ---------------------------------------------------------------------------
// Local glob-to-regex helper (no external dependencies)
// ---------------------------------------------------------------------------

/**
 * Converts a glob pattern to a RegExp. Supports:
 *   **   → matches any sequence of chars including /
 *   *    → matches any sequence of chars except /
 *   ?    → matches exactly one char except /
 *   All other regex special chars are escaped.
 */
export function globToRegex(pattern: string): RegExp {
  const reStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&") // escape regex specials (not * ?)
    .replace(/\*\*/g, "\x00")              // placeholder for **
    .replace(/\*/g, "[^/]*")              // * → any non-slash sequence
    .replace(/\x00/g, ".*")               // ** → anything
    .replace(/\?/g, "[^/]");              // ? → one non-slash char
  return new RegExp(reStr, "i");
}

/**
 * Extracts non-trivial literal segments from a glob pattern (segments that
 * contain no wildcard chars and are at least 4 chars long). Used for
 * matching against free-text proposal bodies.
 */
function extractLiteralSegments(pattern: string): string[] {
  return pattern
    .split(/\*+|\?/)
    .map((s) => s.replace(/^[/\\]+|[/\\]+$/g, ""))
    .filter((s) => s.length >= 4 && !/[*?]/.test(s));
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------------------------------------------------------
// Text matching: check whether a free-text proposal references a frozen item
// ---------------------------------------------------------------------------

interface MatchResult {
  matched: boolean;
  matched_on: string;
}

function matchesText(item: FreezeListItem, text: string): MatchResult {
  // 1. Match on item id (word-boundary, case-insensitive)
  if (new RegExp(`\\b${escapeRegex(item.id)}\\b`, "i").test(text)) {
    return { matched: true, matched_on: `id "${item.id}"` };
  }

  // 2. Match on item label (case-insensitive substring)
  if (text.toLowerCase().includes(item.label.toLowerCase())) {
    return { matched: true, matched_on: `label "${item.label}"` };
  }

  // 3. Match on literal segments extracted from each pattern
  for (const pattern of item.patterns) {
    for (const seg of extractLiteralSegments(pattern)) {
      if (text.toLowerCase().includes(seg.toLowerCase())) {
        return { matched: true, matched_on: `pattern segment "${seg}"` };
      }
    }
  }

  return { matched: false, matched_on: "" };
}

// ---------------------------------------------------------------------------
// Acknowledgment check
// ---------------------------------------------------------------------------
//
// A valid acknowledgment must contain BOTH:
//   1. Explicit override/acknowledgment language (one of the phrases below)
//   2. The protected item's id OR label, within 200 chars of the language match
//
// Checking a bare item id without override language is NOT sufficient.

const ACKNOWLEDGMENT_PHRASES = [
  /freeze[\s-]list\s+override\s+approved\s+for/i,
  /freeze[\s-]list\s+override/i,
  /protected\s+contract\s+change\s+approved\s+for/i,
  /protected\s+contract\s+change\s+approved/i,
  /explicit\s+freeze[\s-]list\s+acknowledgment[:\s]/i,
  /freeze[\s-]list\s+acknowledged/i,
  /override\s+approved\s+for/i,
];

function isAcknowledged(
  item: FreezeListItem,
  ...texts: (string | undefined)[]
): boolean {
  const combined = texts.filter(Boolean).join("\n\n");

  for (const phrase of ACKNOWLEDGMENT_PHRASES) {
    const match = phrase.exec(combined);
    if (match === null) continue;

    // Extract a ±200-char window around the match to check for proximity
    const windowStart = Math.max(0, match.index - 200);
    const windowEnd = match.index + match[0].length + 200;
    const window = combined.slice(windowStart, windowEnd);

    const hasId = new RegExp(`\\b${escapeRegex(item.id)}\\b`, "i").test(window);
    const hasLabel = window.toLowerCase().includes(item.label.toLowerCase());

    if (hasId || hasLabel) return true;
  }

  return false;
}

// ---------------------------------------------------------------------------
// Freeze-list loader
// ---------------------------------------------------------------------------

const FREEZE_LIST_PATH = path.join(
  path.resolve(process.cwd(), "has-data"),
  "freeze-list.json",
);

/**
 * Loads the freeze-list config from has-data/freeze-list.json.
 *
 * Returns null if the file does not exist (non-fatal — caller proceeds without
 * freeze-list checking but still includes an informational note in the export).
 *
 * Throws FreezeListConfigError if the file exists but is malformed or fails
 * structural validation.
 */
export function loadFreezeList(): FreezeList | null {
  if (!fs.existsSync(FREEZE_LIST_PATH)) {
    return null;
  }

  let raw: string;
  try {
    raw = fs.readFileSync(FREEZE_LIST_PATH, "utf-8");
  } catch (e) {
    throw new FreezeListConfigError(
      `Could not read freeze-list.json: ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new FreezeListConfigError(
      "freeze-list.json is not valid JSON.",
    );
  }

  // Structural validation
  if (typeof parsed !== "object" || parsed === null) {
    throw new FreezeListConfigError("freeze-list.json root must be an object.");
  }
  const obj = parsed as Record<string, unknown>;
  if (obj["version"] !== 1) {
    throw new FreezeListConfigError(
      `freeze-list.json version must be 1, got: ${String(obj["version"])}`,
    );
  }
  if (!Array.isArray(obj["protected_items"])) {
    throw new FreezeListConfigError(
      "freeze-list.json must have a protected_items array.",
    );
  }
  for (let i = 0; i < (obj["protected_items"] as unknown[]).length; i++) {
    const item = (obj["protected_items"] as Record<string, unknown>[])[i];
    for (const field of ["id", "label", "reason"] as const) {
      if (typeof item[field] !== "string" || !(item[field] as string).trim()) {
        throw new FreezeListConfigError(
          `protected_items[${i}].${field} must be a non-empty string.`,
        );
      }
    }
    if (!Array.isArray(item["patterns"])) {
      throw new FreezeListConfigError(
        `protected_items[${i}].patterns must be an array.`,
      );
    }
    if (typeof item["requires_explicit_acknowledgment"] !== "boolean") {
      throw new FreezeListConfigError(
        `protected_items[${i}].requires_explicit_acknowledgment must be a boolean.`,
      );
    }
  }

  return parsed as FreezeList;
}

// ---------------------------------------------------------------------------
// Main proposal checker
// ---------------------------------------------------------------------------

export type FreezeCheckResult =
  | { ok: true; hits: FreezeListHit[] }
  | { ok: false; blocking_hits: FreezeListHit[]; all_hits: FreezeListHit[] };

/**
 * Checks whether the accepted proposal (and optionally the operator rationale)
 * references any protected freeze-list item without an explicit acknowledgment.
 *
 * Each item is checked by matching its id, label, and literal pattern segments
 * against the combined proposal + rationale text.
 *
 * An acknowledgment is valid only when the text contains both:
 *   - Explicit override/acknowledgment language
 *   - The item's id or label within 200 chars of that language
 */
export function checkProposalAgainstFreezeList(
  proposalText: string,
  operatorRationale: string | undefined,
  freezeList: FreezeList,
): FreezeCheckResult {
  const hits: FreezeListHit[] = [];
  const blockingHits: FreezeListHit[] = [];

  for (const item of freezeList.protected_items) {
    const matchResult = matchesText(item, proposalText);
    if (!matchResult.matched) continue;

    const acknowledged = isAcknowledged(item, proposalText, operatorRationale);

    const hit: FreezeListHit = {
      item_id: item.id,
      item_label: item.label,
      matched_on: matchResult.matched_on,
      reason: item.reason,
      requires_explicit_acknowledgment: item.requires_explicit_acknowledgment,
      acknowledged,
    };

    hits.push(hit);

    if (item.requires_explicit_acknowledgment && !acknowledged) {
      blockingHits.push(hit);
    }
  }

  if (blockingHits.length > 0) {
    return { ok: false, blocking_hits: blockingHits, all_hits: hits };
  }

  return { ok: true, hits };
}

// ---------------------------------------------------------------------------
// Export markdown section builder
// ---------------------------------------------------------------------------

/**
 * Builds the "Protected Contracts — Freeze List" section for inclusion in
 * every exported Antigravity task file. Always included — even when no items
 * are matched — to give Antigravity visibility into what is protected.
 */
export function buildFreezeListSection(
  freezeList: FreezeList | null,
  hits: FreezeListHit[],
): string[] {
  const lines: string[] = [
    "## 🔒 Protected Contracts — Freeze List",
    "",
  ];

  if (freezeList === null) {
    lines.push(
      "> `has-data/freeze-list.json` not found. No freeze-list check was performed.",
      "> To protect contracts from accidental agent drift, create a freeze-list config.",
      "",
    );
    return lines;
  }

  const total = freezeList.protected_items.length;
  lines.push(
    `Freeze list v${freezeList.version} — ${total} protected item${total === 1 ? "" : "s"} registered.`,
    "",
    "| ID | Label | Referenced | Acknowledged |",
    "|---|---|---|---|",
  );

  for (const item of freezeList.protected_items) {
    const hit = hits.find((h) => h.item_id === item.id);
    const referenced = hit ? `⚠️ Yes (${hit.matched_on})` : "✅ No";
    const ack = hit
      ? hit.acknowledged
        ? "✅ Yes"
        : item.requires_explicit_acknowledgment
          ? "❌ Required — not found"
          : "— (not required)"
      : "—";
    lines.push(`| \`${item.id}\` | ${item.label} | ${referenced} | ${ack} |`);
  }
  lines.push("");

  // Detail for any hits
  const hitItems = hits.filter(Boolean);
  if (hitItems.length > 0) {
    lines.push("### Referenced protected items", "");
    for (const hit of hitItems) {
      lines.push(`**${hit.item_id}** — ${hit.item_label}`);
      lines.push(`- Matched on: ${hit.matched_on}`);
      lines.push(`- Protected because: ${hit.reason}`);
      lines.push(
        `- Acknowledgment required: ${hit.requires_explicit_acknowledgment ? "yes" : "no"}`,
      );
      lines.push(`- Acknowledged: ${hit.acknowledged ? "yes" : "**NO — export would be blocked**"}`);
      lines.push("");
    }
  }

  if (hitItems.length === 0) {
    lines.push(
      "> No protected items were referenced in this proposal.",
      "> All protected contracts are clear.",
      "",
    );
  }

  return lines;
}
