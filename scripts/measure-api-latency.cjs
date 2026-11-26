// Node 22. Usage: node scripts/measure-api-latency.cjs <base-url> <before|after> [rounds]
const { setTimeout: sleep } = require('node:timers/promises');

const paths = [
  '/learning/home', '/learning/progress', '/learning/lessons',
  '/vocabulary/summary', '/vocabulary/decks', '/vocabulary/curated-topics',
];

async function main() {
  const [base, phase, count = '50'] = process.argv.slice(2);
  const rounds = Number(count);
  if (!base || !['before', 'after'].includes(phase) || !Number.isSafeInteger(rounds) || rounds < 1) {
    throw new Error('Expected <base-url> <before|after> [positive integer rounds]');
  }
  const url = new URL(base);
  if (url.username || url.password || url.search || url.hash ||
      !(url.protocol === 'https:' || (url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)))) {
    throw new Error('Use an HTTPS API URL or loopback HTTP, without credentials, query or fragment');
  }
  const token = process.env.LINGOROAD_BENCH_TOKEN;
  if (!token) throw new Error('Set LINGOROAD_BENCH_TOKEN to a QA learner access token');
  const results = paths.map(path => ({ path, times: [], failures: {} }));
  const startedAt = new Date().toISOString();
  for (let round = 0; round <= rounds; round++) {
    for (const row of results) {
      let failure;
      try {
        const start = performance.now();
        const response = await fetch(base.replace(/\/+$/, '') + row.path, {
          headers: row.path === '/vocabulary/curated-topics' ? {} : { Authorization: 'Bearer ' + token },
          redirect: 'error', signal: AbortSignal.timeout(15000),
        });
        const bytes = await response.arrayBuffer();
        const elapsed = performance.now() - start;
        if (response.status !== 200) failure = 'HTTP ' + response.status;
        else if (JSON.parse(Buffer.from(bytes).toString()).success !== true) failure = 'invalid API response';
        else if (round > 0) row.times.push(elapsed);
      } catch (error) {
        failure = error.name;
      }
      if (failure) {
        if (round === 0) throw new Error('Warm-up failed: ' + row.path + ' (' + failure + ')');
        row.failures[failure] = (row.failures[failure] ?? 0) + 1;
      }
      await sleep(400);
    }
  }
  const endpoints = results.map(({ path, times, failures }) => {
    times.sort((a, b) => a - b);
    const percentile = p => times.length ? Number(times[Math.ceil(p * times.length) - 1].toFixed(1)) : null;
    return { path, successful: times.length, failures, p50Ms: percentile(0.50), p95Ms: percentile(0.95) };
  });
  console.log(JSON.stringify({ base, phase, startedAt, rounds, concurrency: 1, warmupRounds: 1, delayMs: 400, endpoints }, null, 2));
  if (endpoints.some(row => row.successful !== rounds)) process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
