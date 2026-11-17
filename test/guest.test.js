'use strict';
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setupDb, teardownDb, clearDb, http, makeUser } = require('./helpers');
const config = require('../src/config');
const { publishedArticles } = require('./fixtures');
const { assembleDailyQuiz } = require('../src/modules/quiz/quiz.service');
const { Question } = require('../src/modules/quiz/question.model');
const { Attempt } = require('../src/modules/quiz/attempt.model');
const { Quiz } = require('../src/modules/quiz/quiz.model');
const { PracticeAnswer } = require('../src/modules/practice/practice.model');

const savedPremium = { ...config.premium };
before(() => setupDb(__filename));
after(async () => { Object.assign(config.premium, savedPremium); await teardownDb(); });
beforeEach(async () => { await clearDb(); Object.assign(config.premium, savedPremium); });

test('guests can take the daily quiz: graded with explanations, nothing saved, then claimed on sign-up', async () => {
  const editor = await makeUser('editor');
  await publishedArticles(1, editor.user._id);
  const { quiz } = await assembleDailyQuiz({ size: 2 });
  const qs = await Question.find({ _id: { $in: quiz.questions } }).lean();
  const answers = qs.map((q, i) => ({ questionId: String(q._id), selectedIndex: i === 0 ? q.correctIndex : (q.correctIndex + 1) % 4 }));

  const r = await http().post(`/api/v1/quizzes/${quiz._id}/check`).send({ answers });
  assert.equal(r.status, 200);
  assert.equal(r.body.result.saved, false);
  assert.equal(r.body.result.id, null);
  assert.equal(r.body.result.score, 1);
  assert.ok(r.body.result.answers.every((a) => a.explanation));
  assert.equal(await Attempt.countDocuments(), 0, 'nothing stored for guests');

  // The app submits the same answers once the guest creates an account.
  const reg = await http().post('/api/v1/auth/register').send({ email: 'new@example.com', name: 'New', password: 'password123' });
  const claim = await http().post(`/api/v1/quizzes/${quiz._id}/attempts`).set('Authorization', `Bearer ${reg.body.token}`).send({ answers });
  assert.equal(claim.status, 201);
  assert.equal(claim.body.result.score, 1);
});

test('guests cannot check archive quizzes when premium is on', async () => {
  config.premium.enabled = true;
  const editor = await makeUser('editor');
  await publishedArticles(1, editor.user._id);
  const { quiz } = await assembleDailyQuiz({ size: 1 });
  await Quiz.updateOne({ _id: quiz._id }, { $set: { publishedAt: new Date(Date.now() - 40 * 86400000) } });
  const r = await http().post(`/api/v1/quizzes/${quiz._id}/check`).send({ answers: [] });
  assert.equal(r.status, 403);
});

test('guests can practise without anything stored, up to the free daily limit when premium is on', async () => {
  config.premium.enabled = true;
  config.premium.freePracticePerDay = 2;
  const editor = await makeUser('editor');
  await publishedArticles(2, editor.user._id);
  const set = await http().get('/api/v1/practice/questions?subject=polity');
  assert.equal(set.status, 200);
  assert.ok(set.body.questions.length >= 3);
  const ids = set.body.questions.map((q) => q.id);
  // The rate limiter is per IP; use a distinct IP for this test.
  const as = (req) => req.set('X-Forwarded-For', '203.0.113.7');
  for (const id of ids.slice(0, 2)) {
    const r = await as(http().post('/api/v1/practice/answers')).send({ questionId: id, selectedIndex: 0 });
    assert.equal(r.status, 201);
    assert.equal(r.body.saved, false);
    assert.ok(r.body.explanation);
  }
  const blocked = await as(http().post('/api/v1/practice/answers')).send({ questionId: ids[2], selectedIndex: 0 });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.error.code, 'premium_required');
  assert.equal(await PracticeAnswer.countDocuments(), 0);
  assert.equal((await http().get('/api/v1/practice/stats')).status, 401, 'stats need an account');

  // A signed-in user on the same network isn't affected by the guest limit.
  const u = await makeUser();
  const mine = await as(http().post('/api/v1/practice/answers')).set(u.auth).send({ questionId: ids[2], selectedIndex: 0 });
  assert.equal(mine.status, 201);
});
