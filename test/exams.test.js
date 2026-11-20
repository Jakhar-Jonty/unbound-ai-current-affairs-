'use strict';
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setupDb, teardownDb, clearDb, http } = require('./helpers');
const { Article } = require('../src/modules/content/article.model');
const { parseGeneratedOutput } = require('../src/modules/pipeline/prompts');
const { publishedArticles, generateArticles } = require('./fixtures');

before(() => setupDb(__filename));
after(teardownDb);
beforeEach(clearDb);

test('generated articles carry exam tags and the taxonomy lists the exams', async () => {
  const [a] = await generateArticles(1);
  assert.deepEqual([...a.tags.exams], ['upsc', 'state-psc', 'ssc']);
  const tax = await http().get('/api/v1/taxonomy');
  assert.deepEqual(Object.keys(tax.body.exams), ['upsc', 'state-psc', 'ssc', 'railways', 'banking', 'insurance', 'defence']);
  assert.equal(tax.body.exams.banking.labelHi, 'बैंकिंग');
});

test('the feed filters by exam, and untagged older articles match every exam', async () => {
  const [ssc, bank, old] = await publishedArticles(3);
  await Article.updateOne({ _id: ssc._id }, { $set: { 'tags.exams': ['ssc', 'railways'] } });
  await Article.updateOne({ _id: bank._id }, { $set: { 'tags.exams': ['banking'] } });
  await Article.updateOne({ _id: old._id }, { $unset: { 'tags.exams': 1 } });
  const ids = async (q) => (await http().get(`/api/v1/articles${q}`)).body.items.map((i) => i.id).sort();

  assert.deepEqual(await ids('?exams=banking'), [bank.id, old.id].sort());
  assert.deepEqual(await ids('?exams=ssc,defence'), [ssc.id, old.id].sort());
  assert.equal((await ids('')).length, 3, 'no exams = everything');
  const item = (await http().get('/api/v1/articles?exams=banking')).body.items.find((i) => i.id === bank.id);
  assert.deepEqual(item.tags.exams, ['banking']);
  assert.equal((await http().get('/api/v1/articles?exams=nasa')).status, 400);
});

test('exam tags from the AI are cleaned up, with a sensible default', () => {
  const base = {
    relevant: true, relevanceReason: 'x', title: 'A useful story', summary: 'A summary long enough.', body: 'B'.repeat(60),
    keyPoints: ['k'], upscRelevance: 'Why it matters here.', gsPaper: 'GS3', subjects: ['economy'], keywords: [], factsToVerify: [],
    questions: [{ stem: 'Which is right here?', options: ['a', 'b', 'c', 'd'], correctIndex: 0, explanation: 'Because a is right.', difficulty: 'easy' }],
  };
  assert.deepEqual(parseGeneratedOutput({ ...base, exams: ['banking', 'banking', 'nasa', 'ssc'] }).data.exams, ['banking', 'ssc']);
  assert.deepEqual(parseGeneratedOutput({ ...base, exams: [] }).data.exams, ['upsc', 'state-psc']);
  assert.deepEqual(parseGeneratedOutput({ ...base }).data.exams, ['upsc', 'state-psc']);
});

test('editors can change exam tags', async () => {
  const { makeUser } = require('./helpers');
  const { token } = await makeUser('editor');
  const [a] = await generateArticles(1);
  const r = await http().patch(`/api/v1/admin/articles/${a.id}`).set('Authorization', `Bearer ${token}`).send({ tags: { exams: ['defence'] } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([...(await Article.findById(a._id)).tags.exams], ['defence']);
  const bad = await http().patch(`/api/v1/admin/articles/${a.id}`).set('Authorization', `Bearer ${token}`).send({ tags: { exams: [] } });
  assert.equal(bad.status, 400);
});

test('changing only the exams on a published article is not a correction and keeps Hindi', async () => {
  const { token } = await require('./helpers').makeUser('editor');
  const [a] = await publishedArticles(1);
  await Article.updateOne({ _id: a._id }, { $set: { translations: { hi: { title: 'हिंदी शीर्षक', summary: 'सारांश', body: 'मुख्य भाग', keyPoints: ['बिंदु'], status: 'published', sourceVersion: a.version } } } });
  const r = await http().patch(`/api/v1/admin/articles/${a.id}`).set('Authorization', `Bearer ${token}`).send({ tags: { exams: ['banking', 'ssc'] } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const after = await Article.findById(a._id);
  assert.deepEqual([...after.tags.exams], ['banking', 'ssc']);
  assert.equal(after.version, a.version, 'no new version');
  assert.equal(after.corrections.length, 0, 'no correction shown to readers');
  const hi = await http().get(`/api/v1/articles/${a.id}?lang=hi`);
  assert.equal(hi.body.article?.lang ?? hi.body.lang, 'hi', 'Hindi still served');

  // Changing the text is still a correction and still needs a note.
  const noNote = await http().patch(`/api/v1/admin/articles/${a.id}`).set('Authorization', `Bearer ${token}`).send({ title: 'A corrected title here' });
  assert.equal(noNote.status, 400);
});
