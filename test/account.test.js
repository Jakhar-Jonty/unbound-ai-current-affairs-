'use strict';
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setupDb, teardownDb, clearDb, http, makeUser } = require('./helpers');
const { outbox } = require('../src/lib/mailer');
const { OneTimeCode } = require('../src/modules/users/codes');
const { User } = require('../src/modules/users/user.model');
const { Attempt } = require('../src/modules/quiz/attempt.model');
const { Bookmark } = require('../src/modules/bookmarks/bookmark.model');
const { computeStreak } = require('../src/modules/quiz/quiz.service');
const { publishedArticles } = require('./fixtures');
const { assembleDailyQuiz } = require('../src/modules/quiz/quiz.service');

before(() => setupDb(__filename));
after(teardownDb);
beforeEach(async () => { await clearDb(); outbox.length = 0; });

const codeFrom = (mail) => mail.subject.match(/^(\d{6})/)[1];

async function signup(email = 'reset@example.com', password = 'old-password-1') {
  const r = await http().post('/api/v1/auth/register').send({ email, name: 'Reset User', password });
  await new Promise((res) => { setTimeout(res, 50); });
  outbox.length = 0; // Drop the sign-up verification email.
  return r.body;
}

test('forgot password emails a code and never reveals whether the email exists', async () => {
  await signup();
  const unknown = await http().post('/api/v1/auth/password/forgot').send({ email: 'nobody@example.com' });
  assert.equal(unknown.status, 202);
  assert.equal(outbox.length, 0);

  const r = await http().post('/api/v1/auth/password/forgot').send({ email: 'Reset@Example.com' });
  assert.equal(r.status, 202);
  assert.equal(outbox.length, 1);
  assert.equal(outbox[0].to, 'reset@example.com');
  const stored = await OneTimeCode.findOne({ purpose: 'password_reset' });
  assert.notEqual(stored.codeHash, codeFrom(outbox[0]), 'the code is stored hashed');

  await http().post('/api/v1/auth/password/forgot').send({ email: 'reset@example.com' });
  assert.equal(outbox.length, 1, 'resends are throttled');
});

test('reset with the code signs in and ends old sessions', async () => {
  const { token: oldToken } = await signup();
  await http().post('/api/v1/auth/password/forgot').send({ email: 'reset@example.com' });
  const code = codeFrom(outbox[0]);

  const wrong = await http().post('/api/v1/auth/password/reset').send({ email: 'reset@example.com', code: code === '000000' ? '111111' : '000000', password: 'new-password-1' });
  assert.equal(wrong.status, 400);

  const ok = await http().post('/api/v1/auth/password/reset').send({ email: 'reset@example.com', code, password: 'new-password-1' });
  assert.equal(ok.status, 200);
  assert.ok(ok.body.token);

  assert.equal((await http().get('/api/v1/auth/me').set('Authorization', `Bearer ${oldToken}`)).status, 401, 'old token revoked');
  assert.equal((await http().get('/api/v1/auth/me').set('Authorization', `Bearer ${ok.body.token}`)).status, 200);
  assert.equal((await http().post('/api/v1/auth/login').send({ email: 'reset@example.com', password: 'new-password-1' })).status, 200);
  assert.equal((await http().post('/api/v1/auth/login').send({ email: 'reset@example.com', password: 'old-password-1' })).status, 401);

  const reuse = await http().post('/api/v1/auth/password/reset').send({ email: 'reset@example.com', code, password: 'another-pass-1' });
  assert.equal(reuse.status, 400, 'codes are single use');
});

test('too many wrong codes locks the reset', async () => {
  await signup();
  await http().post('/api/v1/auth/password/forgot').send({ email: 'reset@example.com' });
  const code = codeFrom(outbox[0]);
  const bad = code === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i += 1) {
    await http().post('/api/v1/auth/password/reset').send({ email: 'reset@example.com', code: bad, password: 'new-password-1' });
  }
  const r = await http().post('/api/v1/auth/password/reset').send({ email: 'reset@example.com', code, password: 'new-password-1' });
  assert.equal(r.status, 429);
});

test('change password needs the current one and revokes other sessions', async () => {
  const { token } = await signup('change@example.com');
  const auth = { Authorization: `Bearer ${token}` };
  const bad = await http().post('/api/v1/auth/password/change').set(auth).send({ currentPassword: 'nope', newPassword: 'brand-new-pass' });
  assert.equal(bad.status, 400, 'a wrong password is not a session error');
  assert.equal((await http().get('/api/v1/auth/me').set(auth)).status, 200, 'session still valid after a wrong attempt');
  const ok = await http().post('/api/v1/auth/password/change').set(auth).send({ currentPassword: 'old-password-1', newPassword: 'brand-new-pass' });
  assert.equal(ok.status, 200);
  assert.equal((await http().get('/api/v1/auth/me').set(auth)).status, 401);
  assert.equal((await http().get('/api/v1/auth/me').set('Authorization', `Bearer ${ok.body.token}`)).status, 200);
});

test('delete account removes the user and their personal data', async () => {
  const editor = await makeUser('editor');
  const [a] = await publishedArticles(1, editor.user._id);
  const { user, token } = await signup('delete@example.com');
  const auth = { Authorization: `Bearer ${token}` };
  await http().post('/api/v1/me/bookmarks').set(auth).send({ itemType: 'article', itemId: String(a._id) });

  assert.equal((await http().delete('/api/v1/auth/me').set(auth).send({ password: 'wrong' })).status, 400);
  assert.equal((await http().delete('/api/v1/auth/me').set(auth).send({ password: 'old-password-1' })).status, 204);
  assert.equal(await User.countDocuments({ _id: user.id }), 0);
  assert.equal(await Bookmark.countDocuments({ user: user.id }), 0);
  assert.equal((await http().get('/api/v1/auth/me').set(auth)).status, 401);
});

test('the last admin cannot delete their account', async () => {
  const admin = await makeUser('admin');
  const r = await http().delete('/api/v1/auth/me').set(admin.auth).send({ password: 'password123' });
  assert.equal(r.status, 400);
});

test('streak counts consecutive days with a completed quiz', async () => {
  assert.deepEqual(computeStreak([], '2026-03-10'), { current: 0, best: 0, lastActiveDate: null });
  assert.equal(computeStreak(['2026-03-08', '2026-03-09', '2026-03-10'], '2026-03-10').current, 3);
  assert.equal(computeStreak(['2026-03-08', '2026-03-09'], '2026-03-10').current, 2, 'still alive the next day');
  assert.equal(computeStreak(['2026-03-07', '2026-03-08'], '2026-03-10').current, 0, 'broken after a missed day');
  const s = computeStreak(['2026-02-01', '2026-02-02', '2026-02-03', '2026-02-04', '2026-03-09', '2026-03-10', '2026-03-10'], '2026-03-10');
  assert.equal(s.current, 2);
  assert.equal(s.best, 4);
  assert.equal(computeStreak(['2026-02-28', '2026-03-01'], '2026-03-01').current, 2, 'month boundaries work');

  const editor = await makeUser('editor');
  const student = await makeUser('user');
  await publishedArticles(1, editor.user._id);
  const { quiz } = await assembleDailyQuiz({ size: 1 });
  await Attempt.create({ user: student.user._id, quiz: quiz._id, answers: [], score: 0, total: 0 });
  const p = await http().get('/api/v1/me/progress').set(student.auth);
  assert.equal(p.body.progress.streak.current, 1);
});
