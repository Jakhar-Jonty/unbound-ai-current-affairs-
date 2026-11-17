'use strict';
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setupDb, teardownDb, clearDb, http, makeUser } = require('./helpers');
const { readingMinutes } = require('../src/modules/content/content.service');

before(() => setupDb(__filename));
after(teardownDb);
beforeEach(clearDb);

async function publish(editor, title, subjects, words = 400) {
  const body = `${'word '.repeat(words)}`.trim();
  const r = await http().post('/api/v1/admin/articles').set(editor.auth).send({
    title, summary: `Summary about ${title} for the reader.`, body,
    tags: { gsPaper: 'GS2', subjects }, sources: [{ url: `https://x.test/${encodeURIComponent(title)}` }], factsToVerify: [],
    questions: [{ stem: `Question about ${title}?`, options: ['A', 'B', 'C', 'D'], correctIndex: 0, explanation: 'A is right.' }],
  });
  await http().post(`/api/v1/admin/articles/${r.body.article._id}/approve`).set(editor.auth).send({ confirmedFacts: [] });
  return r.body.article;
}

test('reading time is shown on lists and detail', async () => {
  assert.equal(readingMinutes({ body: 'a '.repeat(50) }), 1, 'at least a minute');
  assert.equal(readingMinutes({ body: 'a '.repeat(1000) }), 5);
  const editor = await makeUser('editor');
  const a = await publish(editor, 'Long read on federalism', ['polity'], 800);
  const list = await http().get('/api/v1/articles');
  assert.equal(list.body.items[0].readingMinutes, 4);
  const detail = await http().get(`/api/v1/articles/${a._id}`);
  assert.equal(detail.body.article.readingMinutes, 4);
});

test('related articles share subjects, most similar first, never the same article', async () => {
  const editor = await makeUser('editor');
  const a = await publish(editor, 'Supreme Court on Governor assent to state bills', ['polity']);
  const b = await publish(editor, 'Governor assent to bills: Supreme Court sets timelines', ['polity']);
  await publish(editor, 'Election Commission announces assembly poll dates', ['polity', 'governance']);
  await publish(editor, 'RBI keeps repo rate unchanged', ['economy']);
  const r = await http().get(`/api/v1/articles/${a._id}/related`);
  assert.equal(r.status, 200);
  assert.equal(r.body.items[0].id, b._id, 'closest story first');
  assert.ok(!r.body.items.some((x) => x.id === a._id));
  assert.ok(!r.body.items.some((x) => /repo rate/.test(x.title)), 'different subject excluded');
  assert.equal((await http().get('/api/v1/articles/0123456789abcdef01234567/related')).status, 404);
});

test('subject preferences and the multi-subject feed', async () => {
  const editor = await makeUser('editor');
  await publish(editor, 'Polity story', ['polity']);
  await publish(editor, 'Economy story', ['economy']);
  await publish(editor, 'Environment story', ['environment']);
  const feed = await http().get('/api/v1/articles?subjects=polity,economy');
  assert.deepEqual(feed.body.items.map((x) => x.title).sort(), ['Economy story', 'Polity story']);
  assert.equal((await http().get('/api/v1/articles?subjects=polity,nonsense')).status, 400);

  const u = await makeUser();
  const r = await http().patch('/api/v1/auth/me').set(u.auth).send({ preferredSubjects: ['polity', 'economy'] });
  assert.deepEqual(r.body.user.preferredSubjects, ['polity', 'economy']);
  assert.equal((await http().patch('/api/v1/auth/me').set(u.auth).send({ preferredSubjects: ['astrology'] })).status, 400);
});
