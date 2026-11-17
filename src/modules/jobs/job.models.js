'use strict';
const mongoose = require('mongoose');

/** One row per job execution: what ran, how long, what it did, and why it failed. */
const jobRunSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, index: true },
    status: { type: String, enum: ['running', 'succeeded', 'failed', 'skipped'], required: true },
    trigger: { type: String, enum: ['cron', 'manual', 'cli'], default: 'cron' },
    triggeredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    startedAt: { type: Date, default: Date.now },
    finishedAt: Date,
    durationMs: Number,
    stats: mongoose.Schema.Types.Mixed,
    error: String,
  },
  { timestamps: false },
);
jobRunSchema.index({ startedAt: -1 });

/**
 * Distributed lock so the same job never runs twice at once — even if the worker is
 * restarted mid-run or more than one worker is started later. Locks expire on their
 * own, so a crashed run cannot block the job forever.
 */
const jobLockSchema = new mongoose.Schema({
  _id: String,
  owner: String,
  lockedUntil: Date,
});

module.exports = {
  JobRun: mongoose.model('JobRun', jobRunSchema),
  JobLock: mongoose.model('JobLock', jobLockSchema),
};
