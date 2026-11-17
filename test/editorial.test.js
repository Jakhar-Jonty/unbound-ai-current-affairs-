'use strict';
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setupDb, teardownDb, clearDb, http, makeUser } = require('./helpers');
const { generateArticles } = require('./fixtures');
const { Question } = require('../src/modules/quiz/question.model');
const { ArticleRevision } = require('../src/modules/content/articleRevision.model');
const { AuditLog } = require('../src/modules/admin/auditLog.model');

before(() => setupDb(__filename));
after(teardownDb);
beforeEach(clearDb);

test('in-review content is hidden from the public API', async () => {
  const [a] = await generateArticles(1);
  const list = await http().get('/api/v1/articles');
  assert.equal(list.body.total, 0);
  assert.equal((await http().get(`/api/v1/articles/${a._id}`)).status, 404);
});

test('approval requires every flagged fact to be confirmed', async () => {
  const editor = await makeUser('editor');
  const [a] = await generateArticles(1);
  const r = await http().post(`/api/v1/admin/articles/${a._id}/approve`).set(editor.auth).send({ confirmedFacts: [] });
  assert.equal(r.status, 400);
  assert.deepEqual(r.body.error.details.unconfirmedFacts, [0]);

  const ok = await http().post(`/api/v1/admin/articles/${a._id}/approve`).set(editor.auth).send({ confirmedFacts: [0], notes: 'Checked against PIB' });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.article.status, 'published');
  assert.equal(ok.body.questionsPublished, 2);
  assert.equal(await Question.countDocuments({ article: a._id, status: 'published' }), 2);
  assert.equal(await ArticleRevision.countDocuments({ article: a._id }), 1);
  assert.equal(await AuditLog.countDocuments({ action: 'article.publish' }), 1);

  const pub = await http().get(`/api/v1/articles/${a.slug}`);
  assert.equal(pub.status, 200);
  assert.equal(pub.body.article.title, a.title);
  assert.equal(pub.body.article.sources[0].url, a.sources[0].url);
  assert.equal(pub.body.article.factsToVerify, undefined, 'internal review data is not public');
  assert.match(pub.headers['cache-control'], /public/);

  const again = await http().post(`/api/v1/admin/articles/${a._id}/approve`).set(editor.auth).send({ confirmedFacts: [0] });
  assert.equal(again.status, 409);
});

test('rejected questions are not published with the article', async () => {
  const editor = await makeUser('editor');
  const [a] = await generateArticles(1);
  const [q1] = await Question.find({ article: a._id }).sort({ createdAt: 1 });
  assert.equal((await http().post(`/api/v1/admin/questions/${q1._id}/reject`).set(editor.auth)).status, 200);
  const ok = await http().post(`/api/v1/admin/articles/${a._id}/approve`).set(editor.auth).send({ confirmedFacts: [0] });
  assert.equal(ok.body.questionsPublished, 1);
  assert.equal((await Question.findById(q1._id)).status, 'rejected');
});

test('editing published content is a versioned correction', async () => {
  const editor = await makeUser('editor');
  const [a] = await generateArticles(1);
  await http().post(`/api/v1/admin/articles/${a._id}/approve`).set(editor.auth).send({ confirmedFacts: [0] });

  const noNote = await http().patch(`/api/v1/admin/articles/${a._id}`).set(editor.auth).send({ summary: 'A corrected summary with the right figure.' });
  assert.equal(noNote.status, 400);

  const fixed = await http().patch(`/api/v1/admin/articles/${a._id}`).set(editor.auth)
    .send({ summary: 'A corrected summary with the right figure.', correctionNote: 'Corrected the allocation figure' });
  assert.equal(fixed.status, 200);
  assert.equal(fixed.body.article.version, 2);
  assert.equal(fixed.body.article.slug, a.slug, 'published slugs never change');

  const revs = await ArticleRevision.find({ article: a._id }).sort({ version: 1 });
  assert.deepEqual(revs.map((r) => r.version), [1, 2]);
  assert.notEqual(revs[0].snapshot.summary, revs[1].snapshot.summary);

  const pub = await http().get(`/api/v1/articles/${a._id}`);
  assert.equal(pub.body.article.corrections[0].note, 'Corrected the allocation figure');
});

test('retracting removes questions from circulation and shows a notice', async () => {
  const editor = await makeUser('editor');
  const [a] = await generateArticles(1);
  await http().post(`/api/v1/admin/articles/${a._id}/approve`).set(editor.auth).send({ confirmedFacts: [0] });
  const r = await http().post(`/api/v1/admin/articles/${a._id}/retract`).set(editor.auth).send({ reason: 'Source withdrew the report' });
  assert.equal(r.status, 200);
  assert.equal(await Question.countDocuments({ article: a._id, status: 'retired' }), 2);

  const pub = await http().get(`/api/v1/articles/${a._id}`);
  assert.equal(pub.status, 200);
  assert.equal(pub.body.article.status, 'retracted');
  assert.equal(pub.body.article.retraction.reason, 'Source withdrew the report');
  assert.equal((await http().get('/api/v1/articles')).body.total, 0);
});

test('reject, manual articles and filters', async () => {
  const editor = await makeUser('editor');
  const [a] = await generateArticles(1);
  const rej = await http().post(`/api/v1/admin/articles/${a._id}/reject`).set(editor.auth).send({ reason: 'Not exam relevant' });
  assert.equal(rej.body.article.status, 'rejected');

  const created = await http().post('/api/v1/admin/articles').set(editor.auth).send({
    title: 'Supreme Court on electoral bonds',
    summary: 'The Supreme Court delivered its judgment on the scheme.',
    body: 'A long enough explainer body about the judgment and its implications for transparency in political funding.',
    tags: { gsPaper: 'GS2', subjects: ['polity'] },
    sources: [{ url: 'https://example.org/judgment', publisher: 'Supreme Court of India' }],
    factsToVerify: ['Judgment date'],
    questions: [{ stem: 'Which body delivered the judgment?', options: ['Supreme Court', 'ECI', 'RBI', 'CAG'], correctIndex: 0, explanation: 'The Supreme Court delivered it.' }],
  });
  assert.equal(created.status, 201);
  const id = created.body.article._id;
  await http().post(`/api/v1/admin/articles/${id}/approve`).set(editor.auth).send({ confirmedFacts: [0] });

  const bySubject = await http().get('/api/v1/articles?subject=polity');
  assert.equal(bySubject.body.total, 1);
  assert.equal((await http().get('/api/v1/articles?subject=economy')).body.total, 0);
  assert.equal((await http().get('/api/v1/articles?subject=nonsense')).status, 400);
  const search = await http().get('/api/v1/articles?q=electoral');
  assert.equal(search.body.total, 1);
});

test('question edits validate the answer index and version published questions', async () => {
  const editor = await makeUser('editor');
  const [a] = await generateArticles(1);
  const [q] = await Question.find({ article: a._id });
  const bad = await http().patch(`/api/v1/admin/questions/${q._id}`).set(editor.auth).send({ correctIndex: 7 });
  assert.equal(bad.status, 400);
  await http().post(`/api/v1/admin/articles/${a._id}/approve`).set(editor.auth).send({ confirmedFacts: [0] });
  const fixed = await http().patch(`/api/v1/admin/questions/${q._id}`).set(editor.auth).send({ correctIndex: 1, correctionNote: 'Answer key was wrong' });
  assert.equal(fixed.status, 200);
  assert.equal(fixed.body.question.version, 2);
  assert.equal(fixed.body.question.difficulty, q.difficulty, 'unspecified fields are untouched');
});
