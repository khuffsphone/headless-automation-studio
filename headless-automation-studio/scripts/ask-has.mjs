// scripts/ask-has.mjs
// Submit an originating question to HAS /api/ask and print all three responses.

import http from 'node:http';

const QUESTION = `ARCHON-005 selection: ARCHON-004 manual playtest is complete. The playtest found no bugs, confirmed Easy and Normal difficulty behavior, confirmed scrollable board log behavior, and recommended CI/regression hardening as the next protective step before any new gameplay features.

Should ARCHON-005 be CI/regression hardening? If yes, define the smallest useful CI baseline. If not, recommend the better next step.

Required output:
- recommended next move
- why this is the right move now
- whether it is execution-ready or planning-only
- files likely involved
- acceptance criteria
- out-of-scope items
- commands to run
- risks or blockers`;

const payload = JSON.stringify({
  question: QUESTION,
  thread_id: 'thread_initial_validation',
  project_id: 'headless_automation_studio',
});

function post(path, data) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

console.log('Submitting ARCHON-005 question to HAS /api/ask...');
console.log('Dispatching to ChatGPT (systems_architect), Gemini (implementation_strategist), Claude (reviewer_synthesizer)...\n');

const start = Date.now();
const result = await post('/api/ask', payload);
const elapsed = ((Date.now() - start) / 1000).toFixed(1);

console.log(`HTTP ${result.status} — completed in ${elapsed}s\n`);

if (result.status !== 200) {
  console.error('Error response:', result.body);
  process.exit(1);
}

const data = JSON.parse(result.body);
const allMessages = data.messages;

// Find the three provider responses (parent = operator message)
const opId = data.operator_message_id;
const responses = allMessages.filter(m => m.parent_message_id === opId);

for (const msg of responses) {
  const label = `[${msg.role.toUpperCase()} — ${msg.specialization}]`;
  const status = msg.status === 'provider_failure' ? '❌ FAILED' : '✅';
  console.log(`${'='.repeat(70)}`);
  console.log(`${status} ${label}  (${msg.model_metadata?.model ?? 'unknown'})`);
  console.log(`${'='.repeat(70)}`);
  console.log(msg.body_markdown);
  console.log();
}

console.log(`\nOperator message ID : ${opId}`);
console.log(`Response IDs        : ${data.response_message_ids.join(', ')}`);
