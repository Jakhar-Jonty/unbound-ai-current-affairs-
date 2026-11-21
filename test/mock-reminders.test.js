'use strict';
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setupDb, teardownDb, clearDb, http, makeUser } = require('./helpers');
const config = require('../src/config');
const { publishedArticles } = require('./fixtures');
const mock = require('../src/modules/quiz/mock.service');
const { assembleDailyQuiz } = require('../src/modules/quiz/quiz.service');
const { Question } = require('../src/modules/quiz/question.model');
const { Quiz } = require('../src/modules/quiz/quiz.model');
const { Attempt, QuizStart } = require('../src/modules/quiz/attempt.model');
const { User } = require('../src/modules/users/user.model');
const { DeviceToken } = require('../src/modules/notifications/deviceToken.model');
const reminders = require('../src/modules/notifications/reminders');
const { translateArticle } = require('../src/modules/pipeline/translate');
const { createMockProvider } = require('../src/modules/pipeline/ai/mock');
const { publishHindi } = require('../src/modules/admin/translation.service');

const savedPremium = { ...config.premium };
before(() => setupDb(__filename));
after(async () => { Object.assign(config.premium, savedPremium); await teardownDb(); });
beforeEach(async () => { await clearDb(); Object.assign(config.premium, savedPremium); });

async function answersFor(quiz, correctCount, skip = 0) {
  const qs = await Question.find({ _id: { $in: quiz.questions } }).lean();
  return qs.map((q, i) => ({
    questionId: String(q._id),
    selectedIndex: i < correctCount ? q.correctIndex : i < qs.length - skip ? (q.correctIndex + 1) % 4 : null,
  }));
}

test('UPSC marking: +2 correct, −2/3 wrong, 0 skipped', () => {
  const g = [true, true, true, false, false, null].map((v) => ({ isCorrect: v === true, selectedIndex: v === null ? null : 1 }));
  assert.deepEqual(mock.scoreMock(g), { marks: 4.67, maxMarks: 12, correct: 3, wrong: 2, unanswered: 1 });
});

test('weekly mock is built once per week from the week’s questions, and needs at least 10', async () => {
  const editor = await makeUser('editor');
  await publishedArticles(4, editor.user._id); // 8 questions
  assert.equal((await mock.assembleWeeklyMock()).reason, 'not_enough_questions');
  await publishedArticles(1, editor.user._id); // 10
  const r = await mock.assembleWeeklyMock();
  assert.equal(r.created, true);
  assert.equal(r.quiz.questions.length, 10);
  assert.equal(r.quiz.durationSeconds, 720);
  assert.equal((await mock.assembleWeeklyMock()).reason, 'already_exists');
});

test('taking a mock: questions only after start, server-timed, marked and ranked', async () => {
  const editor = await makeUser('editor');
  await publishedArticles(5, editor.user._id);
  const { quiz } = await mock.assembleWeeklyMock();
  const [a, b, c] = [await makeUser(), await makeUser(), await makeUser()];

  const before = await http().get('/api/v1/quizzes/mock/current').set(a.auth);
  assert.equal(before.status, 200);
  assert.equal(before.body.requiresStart, true);
  assert.equal(before.body.questions.length, 0, 'no questions before the timer starts');
  assert.equal(before.body.quiz.durationSeconds, 720);

  assert.equal((await http().post(`/api/v1/quizzes/${quiz._id}/check`).send({ answers: [] })).status, 401, 'guests cannot take the mock');
  assert.equal((await http().post(`/api/v1/quizzes/${quiz._id}/attempts`).set(a.auth).send({ answers: [] })).status, 400, 'must start first');

  const start = await http().post(`/api/v1/quizzes/${quiz._id}/start`).set(a.auth);
  assert.equal(start.status, 201);
  assert.equal(start.body.questions.length, 10);
  assert.ok(new Date(start.body.timer.endsAt) > new Date());
  const resumed = await http().get(`/api/v1/quizzes/${quiz._id}`).set(a.auth);
  assert.equal(resumed.body.questions.length, 10, 'resume after reopening the app');
  assert.equal(resumed.body.timer.startedAt, start.body.timer.startedAt);

  const subA = await http().post(`/api/v1/quizzes/${quiz._id}/attempts`).set(a.auth).send({ answers: await answersFor(quiz, 8, 1) });
  assert.equal(subA.status, 201);
  assert.equal(subA.body.result.mock.marks, 15.33); // 8×2 − 1×⅔
  assert.equal(subA.body.result.mock.rank, 1);
  assert.equal((await http().post(`/api/v1/quizzes/${quiz._id}/start`).set(a.auth)).status, 409);

  await http().post(`/api/v1/quizzes/${quiz._id}/start`).set(b.auth);
  const subB = await http().post(`/api/v1/quizzes/${quiz._id}/attempts`).set(b.auth).send({ answers: await answersFor(quiz, 5) });
  assert.equal(subB.body.result.mock.rank, 2);
  assert.equal(subB.body.result.mock.participants, 2);

  // C starts, then submits long after the time limit: counted, not ranked.
  await http().post(`/api/v1/quizzes/${quiz._id}/start`).set(c.auth);
  await QuizStart.updateOne({ user: c.user._id }, { $set: { startedAt: new Date(Date.now() - 3600 * 1000) } });
  const subC = await http().post(`/api/v1/quizzes/${quiz._id}/attempts`).set(c.auth).send({ answers: await answersFor(quiz, 10) });
  assert.equal(subC.body.result.mock.late, true);
  assert.equal(subC.body.result.mock.rank, null);
  assert.equal(subC.body.result.mock.participants, 2);

  const later = await http().get(`/api/v1/attempts/${subA.body.result.id}`).set(a.auth);
  assert.equal(later.body.result.mock.rank, 1);
  assert.equal((await http().get('/api/v1/leaderboard/weekly')).body.participants, 0, 'mock does not count on the daily leaderboard');
});

test('settings: language and notification preferences', async () => {
  const u = await makeUser();
  const r = await http().patch('/api/v1/auth/me').set(u.auth).send({ lang: 'hi', notificationPrefs: { dailyReminder: false } });
  assert.equal(r.body.user.lang, 'hi');
  assert.deepEqual(r.body.user.notificationPrefs, { dailyReminder: false, mock: true, digest: true });
  assert.equal((await http().patch('/api/v1/auth/me').set(u.auth).send({ lang: 'fr' })).status, 400);
});

function fakePush() {
  const sent = [];
  return {
    sent,
    opts: { enabled: true, fetchImpl: async (_u, o) => { const m = JSON.parse(o.body); sent.push(...m); return { ok: true, json: async () => ({ data: m.map(() => ({ status: 'ok' })) }) }; } },
  };
}

async function deviceUser({ lang = 'en', active = true, prefs } = {}) {
  const u = await makeUser();
  await User.updateOne({ _id: u.user._id }, { $set: { lang, ...(active ? { lastLoginAt: new Date() } : {}), ...(prefs ? { notificationPrefs: prefs } : {}) } });
  await DeviceToken.create({ user: u.user._id, token: `ExponentPushToken[${u.user._id}]`, platform: 'android' });
  return u;
}

test('evening reminder: streak message, in the user’s language, skips done/opted-out/inactive, never twice', async () => {
  const editor = await makeUser('editor');
  await publishedArticles(1, editor.user._id);
  const { quiz } = await assembleDailyQuiz({ size: 2 });
  const streaky = await deviceUser({ lang: 'hi' });
  const yesterdayQuiz = await Quiz.create({ type: 'topic', title: 'old', questions: [], status: 'published' });
  await Attempt.create({ user: streaky.user._id, quiz: yesterdayQuiz._id, answers: [], score: 0, total: 0, submittedAt: new Date(Date.now() - 86400000) });
  const fresh = await deviceUser();
  const done = await deviceUser();
  await Attempt.create({ user: done.user._id, quiz: quiz._id, answers: [], score: 0, total: 0 });
  await deviceUser({ prefs: { dailyReminder: false, mock: true } });
  await deviceUser({ active: false });

  const push = fakePush();
  const r = await reminders.sendDailyReminders(push.opts);
  assert.equal(r.users, 2);
  const byToken = Object.fromEntries(push.sent.map((m) => [m.to, m]));
  assert.match(byToken[`ExponentPushToken[${streaky.user._id}]`].title, /^अपनी 1 दिन की लय/);
  assert.equal(byToken[`ExponentPushToken[${fresh.user._id}]`].title, 'Today’s quiz is waiting');
  assert.equal(byToken[`ExponentPushToken[${fresh.user._id}]`].data.quizId, String(quiz._id));

  const again = await reminders.sendDailyReminders(push.opts);
  assert.equal(again.users, 0, 'no second reminder for the same day');
});

test('mock notifications: opening push and Saturday reminder for those who haven’t taken it', async () => {
  const editor = await makeUser('editor');
  await publishedArticles(5, editor.user._id);
  const { quiz } = await mock.assembleWeeklyMock();
  const taker = await deviceUser();
  const other = await deviceUser({ lang: 'hi' });
  await deviceUser({ prefs: { dailyReminder: true, mock: false } });
  const push = fakePush();
  const open = await reminders.sendMockOpen(quiz, push.opts);
  assert.equal(open.users, 2);
  assert.ok(push.sent.some((m) => m.title === 'इस सप्ताह का मॉक टेस्ट उपलब्ध है'));

  await Attempt.create({ user: taker.user._id, quiz: quiz._id, answers: [], score: 0, total: 0 });
  const push2 = fakePush();
  const last = await reminders.sendMockReminders(push2.opts);
  assert.equal(last.users, 1);
  assert.equal(push2.sent[0].to, `ExponentPushToken[${other.user._id}]`);
});

test('audio briefing: Premium, and in Hindi only articles with published Hindi', async () => {
  config.premium.enabled = true;
  const editor = await makeUser('editor');
  const [a1] = await publishedArticles(2, editor.user._id);
  const u = await makeUser();
  assert.equal((await http().get('/api/v1/briefing/today').set(u.auth)).status, 403);
  await User.updateOne({ _id: u.user._id }, { $set: { premium: { plan: 'complimentary', until: new Date(Date.now() + 86400000), source: 'admin', status: 'active' } } });

  const en = await http().get('/api/v1/briefing/today').set(u.auth);
  assert.equal(en.status, 200);
  assert.equal(en.body.items.length, 2);
  assert.match(en.body.intro, /^Hello\. This is your current affairs briefing/);

  const none = await http().get('/api/v1/briefing/today?lang=hi').set(u.auth);
  assert.equal(none.body.items.length, 0);
  await translateArticle(a1._id, { provider: createMockProvider() });
  await publishHindi(a1._id, { userId: editor.user._id });
  const hi = await http().get('/api/v1/briefing/today?lang=hi').set(u.auth);
  assert.equal(hi.body.items.length, 1);
  assert.match(hi.body.intro, /^नमस्ते/);
  assert.ok(hi.body.items[0].text.startsWith('[हिंदी]'));
});
