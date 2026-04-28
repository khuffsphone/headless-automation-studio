// scripts/check-ci.mjs
// Poll the GitHub Actions API for the latest workflow run on archon-game main.

import https from 'node:https';

const OWNER = 'khuffsphone';
const REPO  = 'archon-game';
const SHA   = '57ee79a'; // commit we just pushed

function get(url) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: url,
      method: 'GET',
      headers: {
        'User-Agent': 'archon-ci-checker/1.0',
        'Accept': 'application/vnd.github+json',
      },
    };
    https.get(options, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(data) }));
    }).on('error', reject);
  });
}

// Get the latest runs for the CI workflow
const runsRes = await get(`/repos/${OWNER}/${REPO}/actions/runs?branch=main&per_page=5`);

if (runsRes.status !== 200) {
  console.error('GitHub API error:', runsRes.status, JSON.stringify(runsRes.body));
  process.exit(1);
}

const runs = runsRes.body.workflow_runs ?? [];
if (runs.length === 0) {
  console.log('No workflow runs found yet — the run may not have been queued.');
  process.exit(0);
}

for (const run of runs.slice(0, 3)) {
  const matchesSha = run.head_sha.startsWith(SHA);
  console.log(`Run #${run.run_number} | ${run.name} | ${run.status} | ${run.conclusion ?? 'pending'} | SHA: ${run.head_sha.slice(0,7)} ${matchesSha ? '← THIS COMMIT' : ''}`);
  console.log(`  URL: ${run.html_url}`);
  if (matchesSha) {
    console.log(`\nTarget run status : ${run.status}`);
    console.log(`Target run result : ${run.conclusion ?? '(not yet complete)'}`);
    console.log(`Workflow URL      : ${run.html_url}`);
  }
}
