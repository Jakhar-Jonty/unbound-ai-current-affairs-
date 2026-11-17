'use strict';
/** Runs one pipeline job once, e.g. `npm run job -- generate-content`. */
const db = require('../src/lib/db');
const { jobs } = require('../src/modules/jobs/registry');
const { runJob } = require('../src/modules/jobs/runner');

async function main() {
  const name = process.argv[2];
  if (!jobs[name]) throw new Error(`Usage: npm run job -- <${Object.keys(jobs).join('|')}>`);
  await db.connect();
  const run = await runJob(jobs[name], { trigger: 'cli' });
  console.log(JSON.stringify({ status: run.status, durationMs: run.durationMs, stats: run.stats, error: run.error }, null, 2));
  await db.disconnect();
  process.exit(run.status === 'failed' ? 1 : 0);
}

main().catch((err) => { console.error(err.message); process.exit(1); });
