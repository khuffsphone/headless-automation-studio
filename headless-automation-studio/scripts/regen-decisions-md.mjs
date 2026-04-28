// scripts/regen-decisions-md.mjs
// Regenerate has-data/exports/decisions.md from has-data/decisions.json
// using the same logic as append-decision.mjs.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DECISIONS_FILE = path.join(REPO_ROOT, 'has-data', 'decisions.json');
const EXPORTS_DIR    = path.join(REPO_ROOT, 'has-data', 'exports');
const MD_FILE        = path.join(EXPORTS_DIR, 'decisions.md');

const decisions = JSON.parse(fs.readFileSync(DECISIONS_FILE, 'utf-8'));

if (decisions.length === 0) {
  fs.writeFileSync(MD_FILE, '# Decision Log\n\nNo decisions captured yet.\n', 'utf-8');
  console.log('Written: empty log.');
  process.exit(0);
}

const lines = ['# Decision Log', ''];

for (const d of decisions) {
  lines.push(`## ${d.decision_id} — ${d.architectural_scope || 'decision'}`);
  lines.push('');
  lines.push(`**Created:** ${d.created_at}`);
  lines.push(`**Source:** ${d.source}`);
  lines.push(`**Execution status:** ${d.execution_status}`);
  lines.push(`**Downstream task ready:** ${d.downstream_task_ready ? 'yes' : 'no'}`);
  lines.push('');
  lines.push('### Originating question');
  lines.push('');
  lines.push(d.originating_question);
  lines.push('');
  lines.push('### Accepted proposal');
  lines.push('');
  lines.push(d.accepted_proposal);
  lines.push('');

  if (d.operator_rationale) {
    lines.push('### Operator rationale');
    lines.push('');
    lines.push(d.operator_rationale);
    lines.push('');
  }

  if (d.rejected_alternatives && d.rejected_alternatives.length > 0) {
    lines.push('### Rejected alternatives');
    lines.push('');
    for (const alt of d.rejected_alternatives) {
      lines.push(`- **${alt.source}:** ${alt.summary}`);
      lines.push(`  - *Rejected because:* ${alt.reason_rejected}`);
    }
    lines.push('');
  }

  if (d.dependencies && d.dependencies.length > 0) {
    lines.push('### Dependencies');
    lines.push('');
    for (const dep of d.dependencies) lines.push(`- ${dep}`);
    lines.push('');
  }

  if (d.constraints && d.constraints.length > 0) {
    lines.push('### Constraints');
    lines.push('');
    for (const c of d.constraints) lines.push(`- ${c}`);
    lines.push('');
  }

  if (d.open_questions && d.open_questions.length > 0) {
    lines.push('### Open questions');
    lines.push('');
    for (const q of d.open_questions) lines.push(`- ${q}`);
    lines.push('');
  }

  lines.push('### Quality checklist');
  lines.push('');
  const c = d.decision_quality_checklist;
  lines.push(`- Specific enough: ${c.specific_enough ? 'yes' : 'no'}`);
  lines.push(`- In-scope identified: ${c.scope_in_identified ? 'yes' : 'no'}`);
  lines.push(`- Out-of-scope identified: ${c.scope_out_identified ? 'yes' : 'no'}`);
  lines.push(`- Dependencies captured: ${c.dependencies_captured ? 'yes' : 'no'}`);
  lines.push(`- Ready for execution: ${c.ready_for_execution ? 'yes' : 'no'}`);
  if (c.notes) lines.push(`- Notes: ${c.notes}`);
  lines.push('');
  lines.push('---');
  lines.push('');
}

if (!fs.existsSync(EXPORTS_DIR)) fs.mkdirSync(EXPORTS_DIR, { recursive: true });
fs.writeFileSync(MD_FILE, lines.join('\n'), 'utf-8');

console.log(`Regenerated decisions.md — ${decisions.length} decisions`);
console.log(`File: ${MD_FILE}`);

// Verify the target record
const target = decisions.find(d => d.decision_id === 'dec_x2iug8semoikiug6');
if (target) {
  console.log(`\nVerification — dec_x2iug8semoikiug6:`);
  console.log(`  architectural_scope : ${target.architectural_scope}`);
  console.log(`  execution_status    : ${target.execution_status}`);
}
