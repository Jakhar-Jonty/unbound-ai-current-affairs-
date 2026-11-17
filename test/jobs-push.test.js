'use strict';
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setupDb, teardownDb, clearDb, http, makeUser } = require('./helpers');
const { runJob, acquireLock } = require('../src/modules/jobs/runner');
const { JobRun } = require('../src/modules/jobs/job.models');
const { jobs } = require('../src/modules/jobs/registry');
const push = require('../src/modules/notifications/push.service');
const { DeviceToken, Notification } = require('../src/modules/notifications/deviceToken.model');
const { Quiz } = require('../src/modules/quiz/quiz.model');
const { publishedArticles } = require('./fixtures');

before(() => setupDb(__filename));
after(teardownDb);
beforeEach(clearDb);

test('job runs are recorded with stats or errors', async () => {
  const ok = await runJob({ name: 't-ok', handler: async () => ({ done: 3 }) });
  assert.equal(ok.status, 'succeeded');
  assert.deepEqual(ok.stats, { done: 3 });
  const bad = await runJob({ name: 't-bad', handler: async () => { throw new Error('boom'); } });
  assert.equal(bad.status, 'failed');
  assert.match(bad.error, /boom/);
  assert.equal(await JobRun.countDocuments(), 2);
});

test('a job cannot run twice at the same time', async () => {
  let release;
  const gate = new Promise((r) => { release = r; });
  const job = { name: 't-slow', handler: () => gate.then(() => ({})) };
  const first = runJob(job);
  await new Promise((r) => { setTimeout(r, 50); });
  const second = await runJob(job);
  assert.equal(second.status, 'skipped');
  release();
  assert.equal((await first).status, 'succeeded');
  assert.equal(await acquireLock('t-slow', 1000), true, 'lock is released after the run');
});

test('daily-quiz job builds the quiz and notifies only once', async () => {
  const editor = await makeUser('editor');
  await publishedArticles(1, editor.user._id);
  const run1 = await runJob(jobs['daily-quiz'], { params: { date: '2026-05-01' } });
  assert.equal(run1.status, 'succeeded');
  assert.equal(run1.stats.created, true);
  assert.equal(run1.stats.notified, true);
  const run2 = await runJob(jobs['daily-quiz'], { params: { date: '2026-05-01' } });
  assert.equal(run2.stats.notified, false);
  assert.equal(await Notification.countDocuments(), 1);
  assert.ok((await Quiz.findOne({ date: '2026-05-01' })).notifiedAt);
});

test('push removes tokens Expo reports as unregistered', async () => {
  const u = await makeUser('user');
  await DeviceToken.create([
    { user: u.user._id, token: 'ExponentPushToken[good]', platform: 'android' },
    { user: u.user._id, token: 'ExponentPushToken[dead]', platform: 'ios' },
  ]);
  let sent;
  const fetchImpl = async (_url, opts) => {
    sent = JSON.parse(opts.body);
    return { ok: true, json: async () => ({ data: sent.map((m) => (m.to.includes('dead') ? { status: 'error', details: { error: 'DeviceNotRegistered' } } : { status: 'ok' })) }) };
  };
  const r = await push.broadcast({ title: 'Hi', body: 'Quiz is live' }, { fetchImpl, enabled: true });
  assert.equal(sent.length, 2);
  assert.equal(r.sent, 1);
  assert.equal(r.removedTokens, 1);
  assert.deepEqual((await DeviceToken.find()).map((d) => d.token), ['ExponentPushToken[good]']);

  const dry = await push.broadcast({ title: 'Hi', body: 'Dry' }, { fetchImpl: () => { throw new Error('should not send'); }, enabled: false });
  assert.equal(dry.notification.dryRun, true);
});

test('device registration and admin job endpoints', async () => {
  const u = await makeUser('user');
  const reg = await http().post('/api/v1/me/devices').set(u.auth).send({ token: 'ExponentPushToken[abc123]', platform: 'android', appVersion: '1.0.0' });
  assert.equal(reg.status, 204);
  assert.equal(await DeviceToken.countDocuments({ user: u.user._id }), 1);

  const editor = await makeUser('editor');
  assert.equal((await http().post('/api/v1/admin/jobs/daily-quiz/run').set(editor.auth)).status, 403);
  const admin = await makeUser('admin');
  const run = await http().post('/api/v1/admin/jobs/generate-content/run?wait=true').set(admin.auth);
  assert.equal(run.status, 200);
  assert.equal(run.body.run.status, 'succeeded');
  const dash = await http().get('/api/v1/admin/dashboard').set(editor.auth);
  assert.equal(dash.body.jobs.find((j) => j.name === 'generate-content').lastRun.status, 'succeeded');
});
