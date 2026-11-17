'use strict';
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setupDb, teardownDb, clearDb, http, makeUser } = require('./helpers');
const { publishedArticles, generateArticles } = require('./fixtures');
const { Question } = require('../src/modules/quiz/question.model');

before(() => setupDb(__filename));
after(teardownDb);
beforeEach(clearDb);

test('bookmark articles and questions', async () => {
  const editor = await makeUser('editor');
  const student = await makeUser('user');
  const [a] = await publishedArticles(1, editor.user._id);
  const q = await Question.findOne({ article: a._id });

  const b1 = await http().post('/api/v1/me/bookmarks').set(student.auth).send({ itemType: 'article', itemId: String(a._id), note: 'Revise' });
  assert.equal(b1.status, 201);
  const again = await http().post('/api/v1/me/bookmarks').set(student.auth).send({ itemType: 'article', itemId: String(a._id) });
  assert.equal(again.status, 201, 'bookmarking twice is idempotent');
  await http().post('/api/v1/me/bookmarks').set(student.auth).send({ itemType: 'question', itemId: String(q._id) });

  const list = await http().get('/api/v1/me/bookmarks').set(student.auth);
  assert.equal(list.body.total, 2);
  const art = list.body.items.find((i) => i.itemType === 'article');
  assert.equal(art.item.title, a.title);
  assert.equal(art.note, 'Revise');
  const ques = list.body.items.find((i) => i.itemType === 'question');
  assert.equal(ques.item.correctIndex, q.correctIndex);

  const other = await makeUser('user');
  assert.equal((await http().get('/api/v1/me/bookmarks').set(other.auth)).body.total, 0);
  assert.equal((await http().delete(`/api/v1/me/bookmarks/${art.id}`).set(other.auth)).status, 404);
  assert.equal((await http().delete(`/api/v1/me/bookmarks/${art.id}`).set(student.auth)).status, 204);
  assert.equal((await http().get('/api/v1/me/bookmarks?type=article').set(student.auth)).body.total, 0);
});

test('cannot bookmark unpublished content', async () => {
  const student = await makeUser('user');
  const [draft] = await generateArticles(1);
  const r = await http().post('/api/v1/me/bookmarks').set(student.auth).send({ itemType: 'article', itemId: String(draft._id) });
  assert.equal(r.status, 404);
});
