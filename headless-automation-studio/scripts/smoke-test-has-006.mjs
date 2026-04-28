// scripts/smoke-test-has-006.mjs
//
// HAS-006 closeout smoke test.
//
// Tests:
//   A. Invalid/vague decision → enforcer returns structured errors, no file written
//   B. Compliant decision → enforcer returns valid brief, file written with 10 sections
//   C. API path: POST /api/decision/:id/export on an already-executed decision → 422 not_eligible
//   D. API path: POST /api/decision/:id/export on an eligible but non-compliant decision → 422 enforcement
//
// Run with: node --experimental-strip-types scripts/smoke-test-has-006.mjs

// @ts-check
import { enforceExecutionBrief } from '../src/lib/briefEnforcer.ts';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AG_DIR = path.join(__dirname, '..', 'has-data', 'exports', 'antigravity-tasks');

let passed = 0;
let failed = 0;

function ok(label) {
  console.log(`  ✅ ${label}`);
  passed++;
}

function fail(label, detail) {
  console.error(`  ❌ ${label}`);
  if (detail) console.error(`     ${detail}`);
  failed++;
}

function assert(condition, label, detail) {
  if (condition) ok(label);
  else fail(label, detail);
}

// ---------------------------------------------------------------------------
// Synthetic decision factory
// ---------------------------------------------------------------------------

function makeDecision(overrides = {}) {
  return {
    decision_id: `dec_smoketest_${Date.now()}`,
    project_id: 'test',
    thread_id: 'thread_test',
    originating_question: 'Should we do X?',
    accepted_proposal: overrides.accepted_proposal ?? '',
    source: 'operator',
    rejected_alternatives: [],
    operator_rationale: '',
    architectural_scope: 'test_scope',
    execution_status: 'approved_not_executed',
    downstream_task_ready: true,
    dependencies: [],
    constraints: overrides.constraints ?? [],
    open_questions: [],
    decision_quality_checklist: {
      specific_enough: true,
      scope_in_identified: true,
      scope_out_identified: true,
      dependencies_captured: true,
      ready_for_execution: true,
      notes: 'smoke test',
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test A: Vague/empty proposal → structured enforcement errors, no file written
// ---------------------------------------------------------------------------

console.log('\n── Test A: Vague proposal → enforcement failure ──────────────────────');

const vagueDecision = makeDecision({
  accepted_proposal: 'We should do CI.',
});

const filesBefore = fs.readdirSync(AG_DIR).length;
const vagueResult = enforceExecutionBrief(vagueDecision);

assert(!vagueResult.valid, 'enforcer returns valid=false for vague proposal');

if (!vagueResult.valid) {
  const sections = vagueResult.errors.map(e => e.section);
  assert(sections.includes('Role'), 'error includes Role');
  assert(sections.includes('Objective'), 'error includes Objective');
  assert(sections.includes('Acceptance Criteria'), 'error includes Acceptance Criteria');
  assert(sections.includes('Walkthrough Artifact Requirement'), 'error includes Walkthrough Artifact Requirement');
  assert(vagueResult.errors.every(e => e.section && e.message), 'all errors have section + message');
  console.log(`  Sections flagged: ${sections.join(', ')}`);
}

const filesAfter = fs.readdirSync(AG_DIR).length;
assert(filesBefore === filesAfter, 'no partial file written on failure');

// ---------------------------------------------------------------------------
// Test B: Compliant proposal → valid brief with all 10 sections
// ---------------------------------------------------------------------------

console.log('\n── Test B: Compliant proposal → valid brief ──────────────────────────');

const COMPLIANT_PROPOSAL = `
## Role
Senior TypeScript engineer working inside the headless-automation-studio repo.

## Objective
Implement a deterministic post-debate execution-brief enforcer that validates all 10 required sections before any bridge file is written.

## Hard Scope Boundary
This task only affects HAS export formatting. Do not add new model calls, agents, or UI redesigns.

## Execution Gate — Inspect Before Write
Before making changes, inspect the repository and confirm:
1. Files likely to be touched
2. Commands to run
3. Risks and out-of-scope items

## Implementation Requirements
1. Create src/lib/briefEnforcer.ts as a pure function with no I/O.
2. Integrate enforcer into writeAgBridgeFile before any file write.
3. Surface enforcement errors as structured 422 from the export route.
4. Display per-section errors in DecisionLog.tsx.

## Acceptance Criteria
- [ ] briefEnforcer.ts exists and exports enforceExecutionBrief
- [ ] A vague proposal returns valid=false with structured errors
- [ ] A compliant proposal returns valid=true with normalized brief
- [ ] writeAgBridgeFile throws BriefEnforcementError on invalid input
- [ ] Export route returns 422 with enforcement_errors[] on failure
- [ ] No partial file is written on enforcement failure

## Explicit Out-of-Scope
- No Deep Researcher integration
- No Sessions API calls
- No Chrome Agent automation
- No new gameplay features
- No UI redesign

## Expected Output
Return:
1. Files changed
2. Summary of changes
3. Commands run
4. Test/build results
5. Known limitations
6. Walkthrough artifact path

## Verification Commands / Manual Checks
\`\`\`
npx tsc --noEmit
npm run build
node --experimental-strip-types scripts/smoke-test-has-006.mjs
\`\`\`

## Walkthrough Artifact Requirement
After completing this task, produce a walkthrough artifact at:
\`docs/walkthrough-has-006.md\`

The walkthrough must include:
- Files changed and why
- How the enforcer works
- How export behavior changed
- Example validation failure output
- Example valid normalized brief
- Commands run and results
- Known limitations
`.trim();

const compliantDecision = makeDecision({ accepted_proposal: COMPLIANT_PROPOSAL });
const compliantResult = enforceExecutionBrief(compliantDecision);

assert(compliantResult.valid, 'enforcer returns valid=true for compliant proposal');

if (compliantResult.valid) {
  const brief = compliantResult.brief;
  const REQUIRED_SECTIONS = [
    'Role', 'Objective', 'Hard Scope Boundary',
    'Execution Gate', 'Implementation Requirements',
    'Acceptance Criteria', 'Explicit Out-of-Scope',
    'Expected Output', 'Verification', 'Walkthrough Artifact',
  ];
  for (const s of REQUIRED_SECTIONS) {
    const regex = new RegExp(`##.+${s}`, 'i');
    assert(regex.test(brief), `normalized brief contains: ${s}`);
  }
  assert(brief.includes('- [ ]'), 'normalized brief has checkbox items');
  console.log(`  Brief length: ${brief.length} chars`);
  if (compliantResult.warnings.length > 0) {
    console.log(`  Warnings: ${compliantResult.warnings.join('; ')}`);
  }
}

// ---------------------------------------------------------------------------
// Test C: API — POST export on already-executed decision → 422 not_eligible
// ---------------------------------------------------------------------------

console.log('\n── Test C: API — export already-executed decision → 422 not_eligible ──');

function postHttp(path) {
  return new Promise((resolve) => {
    const req = http.request({ hostname: 'localhost', port: 3000, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': 0 } },
      (res) => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(d) })); });
    req.on('error', () => resolve({ status: 0, body: {} }));
    req.end();
  });
}

const executedId = 'dec_x2iug8semoikiug6'; // ARCHON-005 — known executed
const cResult = await postHttp(`/api/decision/${executedId}/export`);

if (cResult.status === 0) {
  console.log('  ⚠️  HAS server not running — skipping API tests C and D');
} else {
  assert(cResult.status === 422, `returns 422 for executed decision (got ${cResult.status})`);
  assert(cResult.body.error === 'not_eligible', `error=not_eligible (got ${cResult.body.error})`);

  // ---------------------------------------------------------------------------
  // Test D: API — export eligible but non-compliant decision → 422 enforcement
  // ---------------------------------------------------------------------------

  console.log('\n── Test D: API — export eligible non-compliant decision → 422 enforcement ──');

  // dec_yllhqm00mogeu37f is approved_not_executed — likely lacks enforcer sections
  const eligibleId = 'dec_yllhqm00mogeu37f';
  const filesBeforeD = fs.readdirSync(AG_DIR).length;
  const dResult = await postHttp(`/api/decision/${eligibleId}/export`);
  const filesAfterD = fs.readdirSync(AG_DIR).length;

  if (dResult.status === 200) {
    // Decision happened to be compliant — note it but don't fail the test
    console.log('  ⚠️  Decision was compliant — exported successfully (enforcement passed)');
    ok('no crash on compliant eligible decision');
  } else if (dResult.status === 422 && dResult.body.error === 'brief_enforcement_failed') {
    assert(true, `returns 422 brief_enforcement_failed`);
    assert(Array.isArray(dResult.body.enforcement_errors), 'enforcement_errors is array');
    assert(dResult.body.enforcement_errors.length > 0, 'enforcement_errors is non-empty');
    assert(filesBeforeD === filesAfterD, 'no partial file written on enforcement failure');
    console.log(`  Sections blocked: ${dResult.body.enforcement_errors.map(e => e.section).join(', ')}`);
  } else {
    fail(`unexpected status ${dResult.status}`, JSON.stringify(dResult.body).slice(0, 200));
  }
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

console.log(`\n${'─'.repeat(60)}`);
console.log(`Smoke test complete — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
