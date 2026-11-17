'use strict';
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setupDb, teardownDb, clearDb, http, makeUser } = require('./helpers');
const { publishedArticles, generateArticles } = require('./fixtures');
const { translateContent, translateArticle } = require('../src/modules/pipeline/translate');
const { validateTranslation, missingNumbers } = require('../src/modules/pipeline/translatePrompts');
const { createMockProvider } = require('../src/modules/pipeline/ai/mock');
const { assembleDailyQuiz } = require('../src/modules/quiz/quiz.service');
const { Article } = require('../src/modules/content/article.model');
const { Question } = require('../src/modules/quiz/question.model');

before(() => setupDb(__filename));
after(teardownDb);
beforeEach(clearDb);

const mock = createMockProvider();

async function publishedWithNumbers(editor) {
  const r = await http().post('/api/v1/admin/articles').set(editor.auth).send({
    title: 'RBI keeps repo rate at 6.5% for the 8th time',
    summary: 'The Monetary Policy Committee kept the repo rate unchanged at 6.5 per cent.',
    body: 'The MPC, created under the RBI Act, 1934 as amended in 2016, has 6 members and kept the repo rate at 6.5 per cent.',
    keyPoints: ['The MPC has 6 members', 'Statutory since 2016'],
    upscRelevance: 'GS Paper III: monetary policy.',
    tags: { gsPaper: 'GS3', subjects: ['economy'] },
    sources: [{ url: 'https://rbi.org.in/x' }],
    factsToVerify: [],
    questions: [{ stem: 'How many members does the MPC have?', options: ['4', '6', '8', '10'], correctIndex: 1, explanation: 'The MPC has 6 members.' }],
  });
  await http().post(`/api/v1/admin/articles/${r.body.article._id}/approve`).set(editor.auth).send({ confirmedFacts: [] });
  return Article.findById(r.body.article._id);
}

test('number checks catch dropped or changed numbers', () => {
  assert.deepEqual(missingNumbers('In 2016 the MPC had 6 members', 'वर्ष 2016 में MPC के 6 सदस्य थे'), []);
  assert.deepEqual(missingNumbers('In 2016 the MPC had 6 members', 'वर्ष २०१६ में MPC के 6 सदस्य थे'), [], 'Devanagari digits count');
  assert.deepEqual(missingNumbers('Rs 1,00,000 crore', '100000 करोड़ रुपये'), []);
  assert.deepEqual(missingNumbers('6.5 per cent in 2016', '6.5 प्रतिशत'), ['2016']);
});

test('only published English is translated; Hindi waits for review and is not served before', async () => {
  const editor = await makeUser('editor');
  await generateArticles(1); // in review: must not be translated
  const a = await publishedWithNumbers(editor);
  const stats = await translateContent({ provider: mock, limit: 10 });
  assert.equal(stats.candidates, 1);
  assert.equal(stats.translated, 1);

  const fresh = await Article.findById(a._id);
  assert.equal(fresh.translations.hi.status, 'in_review');
  assert.equal(fresh.translations.hi.sourceVersion, 1);
  const q = await Question.findOne({ article: a._id });
  assert.equal(q.translations.hi.status, 'in_review');

  const before = await http().get(`/api/v1/articles/${a._id}?lang=hi`);
  assert.equal(before.body.article.lang, 'en', 'unreviewed Hindi is not shown');
  assert.equal(before.body.article.hindiAvailable, false);

  assert.equal((await translateContent({ provider: mock })).candidates, 0, 'nothing left to translate');
});

test('editor reviews, edits and publishes Hindi; readers get it with ?lang=hi', async () => {
  const editor = await makeUser('editor');
  const a = await publishedWithNumbers(editor);
  await translateArticle(a._id, { provider: mock });

  const detail = await http().get(`/api/v1/admin/articles/${a._id}`).set(editor.auth);
  assert.equal(detail.body.hindi.article, 'in_review');
  assert.deepEqual(detail.body.hindi.warnings, []);
  const queue = await http().get('/api/v1/admin/translations').set(editor.auth);
  assert.equal(queue.body.items.length, 1);

  const kp = (await http().patch(`/api/v1/admin/articles/${a._id}/translations/hi`).set(editor.auth).send({ keyPoints: ['एक'] }));
  assert.equal(kp.status, 400, 'key point count must match English');
  const ed = await http().patch(`/api/v1/admin/articles/${a._id}/translations/hi`).set(editor.auth).send({ title: 'आरबीआई ने रेपो दर 6.5% पर रखी' });
  assert.equal(ed.status, 200);
  const q = await Question.findOne({ article: a._id });
  assert.equal((await http().patch(`/api/v1/admin/questions/${q._id}/translations/hi`).set(editor.auth).send({ options: ['4', '6'] })).status, 400);

  const pub = await http().post(`/api/v1/admin/articles/${a._id}/translations/hi/publish`).set(editor.auth);
  assert.equal(pub.status, 200);
  assert.equal(pub.body.published, 2);
  assert.equal((await http().post(`/api/v1/admin/articles/${a._id}/translations/hi/publish`).set(editor.auth)).status, 409);

  const hi = await http().get(`/api/v1/articles/${a._id}?lang=hi`);
  assert.equal(hi.body.article.lang, 'hi');
  assert.equal(hi.body.article.title, 'आरबीआई ने रेपो दर 6.5% पर रखी');
  assert.match(hi.body.article.body, /^\[हिंदी\]/);
  const en = await http().get(`/api/v1/articles/${a._id}`);
  assert.equal(en.body.article.lang, 'en');
  assert.equal(en.body.article.hindiAvailable, true);
  const list = await http().get('/api/v1/articles?lang=hi');
  assert.equal(list.body.items[0].title, 'आरबीआई ने रेपो दर 6.5% पर रखी');

  const tax = await http().get('/api/v1/taxonomy');
  assert.equal(tax.body.subjects.economy.labelHi, 'भारतीय अर्थव्यवस्था');
});

test('a correction to the English hides the old Hindi until a new translation is reviewed', async () => {
  const editor = await makeUser('editor');
  const a = await publishedWithNumbers(editor);
  await translateArticle(a._id, { provider: mock });
  await http().post(`/api/v1/admin/articles/${a._id}/translations/hi/publish`).set(editor.auth);

  await http().patch(`/api/v1/admin/articles/${a._id}`).set(editor.auth).send({ summary: 'The Monetary Policy Committee kept the repo rate unchanged at 6.25 per cent.', correctionNote: 'Corrected the rate' });
  const r = await http().get(`/api/v1/articles/${a._id}?lang=hi`);
  assert.equal(r.body.article.lang, 'en', 'outdated Hindi is not served');
  assert.match(r.body.article.summary, /6\.25/);

  const s = await translateContent({ provider: mock });
  assert.equal(s.translated, 1);
  const fresh = await Article.findById(a._id);
  assert.equal(fresh.translations.hi.sourceVersion, 2);
  assert.equal(fresh.translations.hi.status, 'in_review');
  // The unchanged question kept its published Hindi.
  const q = await Question.findOne({ article: a._id });
  assert.equal(q.translations.hi.status, 'published');
});

test('a translation that drops a number is rejected and recorded, then given up after 3 tries', async () => {
  const editor = await makeUser('editor');
  const a = await publishedWithNumbers(editor);
  await Article.updateOne({ _id: a._id }, { $set: { title: 'RBI keeps repo rate at 6.5% for the 8th time [bad-hindi]' } });
  for (let i = 0; i < 3; i += 1) assert.equal(await translateArticle(a._id, { provider: mock }), 'failed');
  const fresh = await Article.findById(a._id);
  assert.equal(fresh.translations?.hi, undefined, 'nothing stored');
  assert.match(fresh.translationErrors.hi.message, /numbers missing in Hindi: 6\.5, 8/);
  assert.equal(fresh.translationErrors.hi.attempts, 3);
  assert.equal((await translateContent({ provider: mock })).candidates, 0, 'stops retrying');
  const failed = await http().get('/api/v1/admin/translations?status=failed').set(editor.auth);
  assert.equal(failed.body.items.length, 1);
});

test('validation rejects reordered options and English left untranslated', () => {
  const q = { _id: 'q1', stem: 'Which year?', options: ['2014', '2016', '2018', '2020'], explanation: 'It was 2016.' };
  const base = { article: {}, includeArticle: false, questions: [q] };
  const swapped = validateTranslation({ questions: [{ id: 'q1', stem: 'कौन सा वर्ष?', options: ['2016', '2014', '2018', '2020'], explanation: 'यह 2016 था।' }] }, base);
  assert.equal(swapped.success, false);
  assert.match(swapped.error, /option 1 2014/);
  const english = validateTranslation({ questions: [{ id: 'q1', stem: 'Which year?', options: q.options, explanation: 'It was 2016.' }] }, base);
  assert.equal(english.success, false);
  assert.match(english.error, /Devanagari/);
});

test('rate limits stop the run without counting a failure', async () => {
  const editor = await makeUser('editor');
  const a = await publishedWithNumbers(editor);
  const busy = { name: 'busy', model: 'x', async generateJSON() { const e = new Error('429 Too Many Requests'); e.status = 429; throw e; } };
  const s = await translateContent({ provider: busy });
  assert.equal(s.rateLimited, true);
  assert.equal((await Article.findById(a._id)).translationErrors?.hi?.attempts, undefined);
});

test('quiz, results, practice and saved items come in Hindi when published, English otherwise', async () => {
  const editor = await makeUser('editor');
  const student = await makeUser();
  const [art] = await publishedArticles(1, editor.user._id);
  const { quiz } = await assembleDailyQuiz({ size: 2 });

  const enOnly = await http().get(`/api/v1/quizzes/${quiz._id}?lang=hi`);
  assert.ok(enOnly.body.questions.every((q) => q.lang === 'en'), 'falls back to English');

  await translateArticle(art._id, { provider: mock });
  await http().post(`/api/v1/admin/articles/${art._id}/translations/hi/publish`).set(editor.auth);

  const hiQuiz = await http().get(`/api/v1/quizzes/${quiz._id}?lang=hi`);
  assert.ok(hiQuiz.body.questions.every((q) => q.lang === 'hi' && q.stem.startsWith('[हिंदी]')));
  const qs = await Question.find({ _id: { $in: quiz.questions } }).lean();
  const answers = qs.map((q) => ({ questionId: String(q._id), selectedIndex: q.correctIndex }));
  const sub = await http().post(`/api/v1/quizzes/${quiz._id}/attempts?lang=hi`).set(student.auth).send({ answers });
  assert.equal(sub.body.result.score, qs.length, 'grading is the same in either language');
  assert.ok(sub.body.result.answers.every((x) => x.explanation.startsWith('[हिंदी]')));
  const en = await http().get(`/api/v1/attempts/${sub.body.result.id}`).set(student.auth);
  assert.ok(!en.body.result.answers[0].stem.startsWith('[हिंदी]'));

  const guest = await http().post(`/api/v1/quizzes/${quiz._id}/check?lang=hi`).send({ answers });
  assert.ok(guest.body.result.answers[0].stem.startsWith('[हिंदी]'));

  const prac = await http().get('/api/v1/practice/questions?subject=polity&lang=hi').set(student.auth);
  assert.ok(prac.body.questions[0].stem.startsWith('[हिंदी]'));
  const ans = await http().post('/api/v1/practice/answers?lang=hi').set(student.auth).send({ questionId: prac.body.questions[0].id, selectedIndex: 0 });
  assert.ok(ans.body.explanation.startsWith('[हिंदी]'));

  await http().post('/api/v1/me/bookmarks').set(student.auth).send({ itemType: 'question', itemId: String(qs[0]._id) });
  const saved = await http().get('/api/v1/me/bookmarks?lang=hi').set(student.auth);
  assert.ok(saved.body.items[0].item.stem.startsWith('[हिंदी]'));
});

test('admin re-translate replaces Hindi waiting for review', async () => {
  const editor = await makeUser('editor');
  const a = await publishedWithNumbers(editor);
  await translateArticle(a._id, { provider: mock });
  await http().patch(`/api/v1/admin/articles/${a._id}/translations/hi`).set(editor.auth).send({ title: 'हाथ से बदला गया 6.5 8' });
  const r = await http().post(`/api/v1/admin/articles/${a._id}/translations/hi/retranslate`).set(editor.auth);
  assert.equal(r.status, 200);
  assert.equal(r.body.outcome, 'translated');
  const fresh = await Article.findById(a._id);
  assert.match(fresh.translations.hi.title, /^\[हिंदी\]/);
  assert.equal(fresh.translations.hi.edited, undefined);
});
