'use strict';
/**
 * Background worker: runs the content pipeline on a schedule. Started as its own
 * process (npm run worker) so long AI batches never slow down API requests.
 */
const cron = require('node-cron');
const config = require('./config');
const logger = require('./lib/logger');
const db = require('./lib/db');
const { jobs } = require('./modules/jobs/registry');
const { runJob } = require('./modules/jobs/runner');

async function main() {
  await db.connect();
  const tasks = [];
  const running = new Set();

  for (const job of Object.values(jobs)) {
    if (!cron.validate(job.schedule)) throw new Error(`Invalid cron "${job.schedule}" for ${job.name}`);
    tasks.push(cron.schedule(job.schedule, async () => {
      const p = runJob(job, { trigger: 'cron' });
      running.add(p);
      try { await p; } finally { running.delete(p); }
    }, { timezone: config.timezone, name: job.name, noOverlap: true }));
    logger.info({ job: job.name, schedule: job.schedule, timezone: config.timezone }, 'Job scheduled');
  }
  logger.info({ aiProvider: config.ai.provider }, 'Worker started');

  const shutdown = async (signal) => {
    logger.info({ signal }, 'Worker shutting down; waiting for running jobs');
    tasks.forEach((t) => t.stop());
    const timeout = new Promise((r) => { setTimeout(r, 60000).unref(); });
    await Promise.race([Promise.allSettled([...running]), timeout]);
    await db.disconnect();
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  logger.fatal({ err }, 'Worker failed to start');
  process.exit(1);
});
