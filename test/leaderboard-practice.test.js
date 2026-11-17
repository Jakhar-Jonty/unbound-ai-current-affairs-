'use strict';
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setupDb, teardownDb, clearDb, http, makeUser } = require('./helpers');
const { publishedArticles } = require('./fixtures');
const { assembleDailyQuiz } = require('../src/modules/quiz/quiz.service');
const { displayName } = require('../src/modules/leaderboard/leaderboard.service');
const { Question } = require('../src/modules/quiz/question.model');
const { Quiz } = require('../src/modules/quiz/quiz.model');
const { User } = require('../src/modules/users/user.model');
const { Attempt } = require('../src/modules/quiz/attempt.model');

before(() => setupDb(__filename));
after(teardownDb);
beforeEach(clearDb);

async function takeQuiz(student, quiz, correctCount) {
  const qs = await Question.find({ _id: { $in: quiz.questions } }).lean();
  const answers = qs.map((q, i) => ({ questionId: String(q._id), selectedIndex: i < correctCount ? q.correctIndex : (q.correctIndex + 1) % 4 }));
  const r = await http().post(`/api/v1/quizzes/${quiz._id}/attempts`).set(student.auth).send({ answers });
  assert.equal(r.status, 201);
}

test('display names hide surnames', () => {
  assert.equal(displayName('Priya Sharma'), 'Priya S.');
  assert.equal(displayName('Arjun'), 'Arjun');
  assert.equal(displayName('  Rahul  Kumar  Verma '), 'Rahul V.');
  assert.equal(displayName(''), 'Aspirant');
});

test('weekly leaderboard ranks daily-quiz scores, shares ties and respects opt-out', async () => {
  const editor = await makeUser('editor');
  await publishedArticles(2, editor.user._id);
  const { quiz } = await assembleDailyQuiz({ size: 4 });
  const [a, b, c, d] = await Promise.all([makeUser(), makeUser(), makeUser(), makeUser()]);
  await User.updateOne({ _id: a.user._id }, { name: 'Asha Rao' });
  await takeQuiz(a, quiz, 4);
  await takeQuiz(b, quiz, 2);
  await takeQuiz(c, quiz, 2);
  await takeQuiz(d, quiz, 3);

  // A non-daily quiz does not count.
  const custom = await Quiz.create({ type: 'custom', title: 'Custom', questions: quiz.questions, status: 'published', publishedAt: new Date() });
  await takeQuiz(b, custom, 4);

  const r = await http().get('/api/v1/leaderboard/weekly').set(b.auth);
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.entries.map((e) => [e.rank, e.score]), [[1, 4], [2, 3], [3, 2], [3, 2]]);
  assert.equal(r.body.entries[0].name, 'Asha R.');
  assert.equal(r.body.me.rank, 3);
  assert.equal(r.body.entries.filter((e) => e.isMe).length, 1);
  assert.ok(r.body.week.startDate);

  // Opt out via settings.
  const off = await http().patch('/api/v1/auth/me').set(a.auth).send({ showOnLeaderboard: false });
  assert.equal(off.body.user.showOnLeaderboard, false);
  const r2 = await http().get('/api/v1/leaderboard/weekly').set(a.auth);
  assert.equal(r2.body.me, null);
  assert.equal(r2.body.entries[0].score, 3);
  assert.equal(r2.body.participants, 3);

  // Last week's attempts don't count.
  await Attempt.updateMany({}, { $set: { submittedAt: new Date(Date.now() - 8 * 86400000) } });
  assert.equal((await http().get('/api/v1/leaderboard/weekly')).body.participants, 0);
});

test('practice: questions by subject, instant feedback, progress and streak', async () => {
  const editor = await makeUser('editor');
  const student = await makeUser();
  await publishedArticles(3, editor.user._id); // 6 questions tagged governance + polity

  assert.equal((await http().get('/api/v1/practice/questions?subject=polity')).status, 401);
  const subjects = await http().get('/api/v1/practice/subjects').set(student.auth);
  assert.equal(subjects.body.subjects.polity, 6);

  const set = await http().get('/api/v1/practice/questions?subject=polity&count=4').set(student.auth);
  assert.equal(set.status, 200);
  assert.equal(set.body.questions.length, 4);
  assert.equal(set.body.questions[0].correctIndex, undefined, 'answers are not sent up front');
  assert.equal((await http().get('/api/v1/practice/questions?subject=economy').set(student.auth)).body.questions.length, 0);

  const q = await Question.findById(set.body.questions[0].id).lean();
  const right = await http().post('/api/v1/practice/answers').set(student.auth).send({ questionId: String(q._id), selectedIndex: q.correctIndex });
  assert.equal(right.status, 201);
  assert.equal(right.body.isCorrect, true);
  assert.ok(right.body.explanation);
  const wrong = await http().post('/api/v1/practice/answers').set(student.auth).send({ questionId: String(set.body.questions[1].id), selectedIndex: 3 });
  assert.equal(typeof wrong.body.correctIndex, 'number');
  assert.equal((await http().post('/api/v1/practice/answers').set(student.auth).send({ questionId: String(q._id), selectedIndex: 9 })).status, 400);

  // Mastered questions go to the back of the queue.
  const next = await http().get('/api/v1/practice/questions?subject=polity&count=5').set(student.auth);
  assert.equal(next.body.newQuestions, 5);
  assert.ok(!next.body.questions.some((x) => x.id === String(q._id)));

  const p = await http().get('/api/v1/me/progress').set(student.auth);
  const polity = p.body.progress.bySubject.find((s) => s.subject === 'polity');
  assert.equal(polity.seen, 2);
  assert.equal(polity.correct, 1 + (wrong.body.isCorrect ? 1 : 0));
  assert.equal(p.body.progress.practice.answered, 2);
  assert.equal(p.body.progress.streak.current, 1, 'practice counts toward the streak');
  assert.equal(p.body.progress.quizzesTaken, 0);

  // Practice never appears on the leaderboard.
  assert.equal((await http().get('/api/v1/leaderboard/weekly')).body.participants, 0);
});
