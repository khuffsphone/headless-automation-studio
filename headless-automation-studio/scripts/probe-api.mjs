// Probe the HAS /api/decision endpoint to verify it's reachable and check available routes
import http from 'node:http';

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data.slice(0, 400) }));
    }).on('error', reject);
  });
}

try {
  const result = await get('http://localhost:3000/api/decision');
  console.log('Status:', result.status);
  console.log('Body:', result.body);
} catch (e) {
  console.error('Connection error:', e.message);
}
