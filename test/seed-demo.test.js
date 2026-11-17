'use strict';
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setupDb, teardownDb, clearDb, http, makeUser } = require('./helpers');
const { publishedArticles } = require('./fixtures');
const { seed, reset, DEMO_EMAIL } = require('../scripts/seed-demo');
const demoArticles = require('../scripts/demo/articles');
const { generatedOutput } = require('../src/modules/pipeline/prompts');
const { Article } = require('../src/modules/content/article.model');
const { Question } = require('../src/modules/quiz/question.model');
const { Quiz } = require('../src/modules/quiz/quiz.model');
const { assembleDailyQuiz } = require('../src/modules/quiz/quiz.service');

before(() => setupDb(__filename));
after(teardownDb);
beforeEach(clearDb);

const quiet = { log: () => {} };

test('demo content passes the same validation as AI output', () => {
  for (const a of demoArticles) {
    const r = generatedOutput.safeParse({ relevant: true, relevanceReason: 'demo', ...a });
    assert.equal(r.success, true, `${a.slug}: ${r.error?.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
    assert.match(a.slug, /^demo-/);
  }
});

test('seed publishes demo content once, with a topic quiz and a signed-in test user', async () => {
  process.env.DEMO_PASSWORD = 'demo-password-1';
  try {
    await seed(quiet);
    await seed(quiet);
  } finally {
    delete process.env.DEMO_PASSWORD;
  }
  assert.equal(await Article.countDocuments({ status: 'published' }), demoArticles.length, 'running twice adds nothing');
  assert.equal(await Quiz.countDocuments({ type: 'topic' }), 1);
  assert.equal(await Quiz.countDocuments({ type: 'daily' }), 0, 'the daily slot is left for the daily-quiz job');

  const list = await http().get('/api/v1/articles');
  assert.equal(list.body.total, demoArticles.length);
  const login = await http().post('/api/v1/auth/login').send({ email: DEMO_EMAIL, password: 'demo-password-1' });
  assert.equal(login.status, 200);
  assert.equal(login.body.user.emailVerified, true);
});

test('reset removes demo content but keeps real articles and quizzes', async () => {
  const editor = await makeUser('editor');
  const [real] = await publishedArticles(1, editor.user._id);
  await seed(quiet);
  const daily = await assembleDailyQuiz({ size: 20 }); // mixes real and demo questions
  assert.equal(daily.created, true);

  await reset(quiet);
  assert.equal(await Article.countDocuments(), 1);
  assert.equal(String((await Article.findOne())._id), String(real._id));
  assert.ok(await Quiz.exists({ _id: daily.quiz._id }), 'a quiz with real questions is kept');
  assert.equal(await Quiz.countDocuments({ type: 'topic' }), 0);
  assert.equal(await Question.countDocuments({ article: real._id }) > 0, true);
});
