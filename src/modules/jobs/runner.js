'use strict';
const crypto = require('node:crypto');
const logger = require('../../lib/logger');
const { JobRun, JobLock } = require('./job.models');

const OWNER = `${process.pid}-${crypto.randomUUID()}`;

async function acquireLock(name, ttlMs) {
  const now = new Date();
  try {
    const lock = await JobLock.findOneAndUpdate(
      { _id: name, $or: [{ lockedUntil: { $lt: now } }, { lockedUntil: null }] },
      { $set: { owner: OWNER, lockedUntil: new Date(now.getTime() + ttlMs) } },
      { upsert: true, returnDocument: 'after' },
    );
    return lock?.owner === OWNER;
  } catch (err) {
    if (err.code === 11000) return false; // Someone else holds an unexpired lock.
    throw err;
  }
}

async function releaseLock(name) {
  await JobLock.updateOne({ _id: name, owner: OWNER }, { $set: { lockedUntil: null } });
}

/**
 * Runs a registered job under a lock and records a JobRun. A job handler receives
 * a context with a child logger and returns a stats object that is stored on the run.
 */
async function runJob(job, { trigger = 'cron', triggeredBy, params = {} } = {}) {
  const ttlMs = job.lockTtlMs ?? 30 * 60 * 1000;
  const log = logger.child({ job: job.name });

  if (!(await acquireLock(job.name, ttlMs))) {
    log.warn('Job already running; skipped');
    return JobRun.create({
      name: job.name, status: 'skipped', trigger, triggeredBy, finishedAt: new Date(), durationMs: 0, error: 'already_running',
    });
  }

  const run = await JobRun.create({ name: job.name, status: 'running', trigger, triggeredBy });
  const started = Date.now();
  log.info({ runId: run._id }, 'Job started');
  try {
    const stats = await job.handler({ log, params, runId: run._id });
    Object.assign(run, { status: 'succeeded', stats });
    log.info({ runId: run._id, stats }, 'Job succeeded');
  } catch (err) {
    Object.assign(run, { status: 'failed', error: String(err?.stack || err).slice(0, 4000) });
    log.error({ runId: run._id, err }, 'Job failed');
  } finally {
    run.finishedAt = new Date();
    run.durationMs = Date.now() - started;
    await run.save();
    await releaseLock(job.name);
  }
  return run;
}

module.exports = { runJob, acquireLock, releaseLock };
