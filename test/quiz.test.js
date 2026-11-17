'use strict';
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setupDb, teardownDb, clearDb, http, makeUser } = require('./helpers');
const { publishedArticles } = require('./fixtures');
const { assembleDailyQuiz } = require('../src/modules/quiz/quiz.service');
const { Question } = require('../src/modules/quiz/question.model');
const { localDateString } = require('../src/lib/dates');

before(() => setupDb(__filename));
after(teardownDb);
beforeEach(clearDb);

test('daily quiz is assembled once per day from unused published questions', async () => {
  const editor = await makeUser('editor');
  await publishedArticles(3, editor.user._id);
  const r1 = await assembleDailyQuiz({ date: '2026-01-01', size: 4 });
  assert.equal(r1.created, true);
  assert.equal(r1.quiz.questions.length, 4);
  const r2 = await assembleDailyQuiz({ date: '2026-01-01', size: 4 });
  assert.equal(r2.created, false);
  assert.equal(r2.reason, 'already_exists');
  const r3 = await assembleDailyQuiz({ date: '2026-01-02', size: 10 });
  assert.equal(r3.quiz.questions.length, 2, 'questions are not reused across daily quizzes');
  const r4 = await assembleDailyQuiz({ date: '2026-01-03' });
  assert.equal(r4.reason, 'no_questions');
});

test('take a quiz: no answers leak, scoring, explanations, one attempt', async () => {
  const editor = await makeUser('editor');
  const student = await makeUser('user');
  await publishedArticles(2, editor.user._id);
  await assembleDailyQuiz({ date: localDateString(), size: 4 });

  const today = await http().get('/api/v1/quizzes/today').set(student.auth);
  assert.equal(today.status, 200);
  assert.equal(today.body.questions.length, 4);
  for (const q of today.body.questions) {
    assert.equal(q.correctIndex, undefined);
    assert.equal(q.explanation, undefined);
  }
  assert.equal(today.body.myAttempt, null);

  const quizId = today.body.quiz.id;
  const truth = await Question.find({ _id: { $in: today.body.questions.map((q) => q.id) } }).lean();
  const key = new Map(truth.map((q) => [String(q._id), q.correctIndex]));
  const [q1, q2, q3] = today.body.questions;
  const answers = [
    { questionId: q1.id, selectedIndex: key.get(q1.id), timeMs: 4000 },
    { questionId: q2.id, selectedIndex: (key.get(q2.id) + 1) % 4 },
    { questionId: q3.id, selectedIndex: null },
  ];

  assert.equal((await http().post(`/api/v1/quizzes/${quizId}/attempts`).send({ answers })).status, 401);

  const sub = await http().post(`/api/v1/quizzes/${quizId}/attempts`).set(student.auth).send({ answers, durationMs: 60000 });
  assert.equal(sub.status, 201);
  assert.equal(sub.body.result.score, 1);
  assert.equal(sub.body.result.total, 4, 'unanswered questions count towards the total');
  assert.ok(sub.body.result.answers.every((a) => a.explanation && a.correctIndex !== undefined));

  const dup = await http().post(`/api/v1/quizzes/${quizId}/attempts`).set(student.auth).send({ answers });
  assert.equal(dup.status, 409);

  const again = await http().get(`/api/v1/quizzes/${quizId}`).set(student.auth);
  assert.equal(again.body.myAttempt.score, 1);

  const other = await makeUser('user');
  assert.equal((await http().get(`/api/v1/attempts/${sub.body.result.id}`).set(other.auth)).status, 404, 'attempts are private');

  const history = await http().get('/api/v1/me/attempts').set(student.auth);
  assert.equal(history.body.total, 1);

  const progress = await http().get('/api/v1/me/progress').set(student.auth);
  assert.equal(progress.body.progress.quizzesTaken, 1);
  assert.equal(progress.body.progress.accuracy, 25);
  assert.ok(progress.body.progress.bySubject.find((s) => s.subject === 'governance'));
});

test('rejects answers for questions outside the quiz and invalid options', async () => {
  const editor = await makeUser('editor');
  const student = await makeUser('user');
  await publishedArticles(1, editor.user._id);
  const { quiz } = await assembleDailyQuiz({ date: '2026-02-01', size: 2 });
  const bogus = await http().post(`/api/v1/quizzes/${quiz._id}/attempts`).set(student.auth)
    .send({ answers: [{ questionId: '0123456789abcdef01234567', selectedIndex: 0 }] });
  assert.equal(bogus.status, 400);
  const badOpt = await http().post(`/api/v1/quizzes/${quiz._id}/attempts`).set(student.auth)
    .send({ answers: [{ questionId: String(quiz.questions[0]), selectedIndex: 9 }] });
  assert.equal(badOpt.status, 400);
});

test('a later answer-key correction does not rewrite a past score', async () => {
  const editor = await makeUser('editor');
  const student = await makeUser('user');
  await publishedArticles(1, editor.user._id);
  const { quiz } = await assembleDailyQuiz({ date: '2026-03-01', size: 1 });
  const qid = String(quiz.questions[0]);
  const q = await Question.findById(qid);
  const sub = await http().post(`/api/v1/quizzes/${quiz._id}/attempts`).set(student.auth)
    .send({ answers: [{ questionId: qid, selectedIndex: q.correctIndex }] });
  assert.equal(sub.body.result.score, 1);

  const newIndex = (q.correctIndex + 1) % 4;
  await http().patch(`/api/v1/admin/questions/${qid}`).set(editor.auth).send({ correctIndex: newIndex, correctionNote: 'Fixed the answer key' });

  const res = await http().get(`/api/v1/attempts/${sub.body.result.id}`).set(student.auth);
  assert.equal(res.body.result.score, 1);
  assert.equal(res.body.result.answers[0].updatedSinceAttempt, true);
  assert.equal(res.body.result.answers[0].currentCorrectIndex, newIndex);
});

test('retired questions drop out of published quizzes', async () => {
  const editor = await makeUser('editor');
  const [a] = await publishedArticles(1, editor.user._id);
  const { quiz } = await assembleDailyQuiz({ date: '2026-04-01', size: 2 });
  await http().post(`/api/v1/admin/articles/${a._id}/retract`).set(editor.auth).send({ reason: 'Wrong report' });
  const r = await http().get(`/api/v1/quizzes/${quiz._id}`);
  assert.equal(r.body.questions.length, 0);
});
