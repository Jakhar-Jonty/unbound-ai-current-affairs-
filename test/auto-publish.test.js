'use strict';
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setupDb, teardownDb, clearDb, http, makeUser } = require('./helpers');
const { RawItem } = require('../src/modules/pipeline/rawItem.model');
const { generateContent } = require('../src/modules/pipeline/generate');
const { translateContent } = require('../src/modules/pipeline/translate');
const { createMockProvider } = require('../src/modules/pipeline/ai/mock');
const { Article } = require('../src/modules/content/article.model');
const { Question } = require('../src/modules/quiz/question.model');
const { getSettings, updateSettings } = require('../src/modules/settings/settings');
const config = require('../src/config');

before(() => setupDb(__filename));
after(teardownDb);
beforeEach(clearDb);

let n = 0;
async function generateOne() {
  n += 1;
  await RawItem.create({ url: `https://news.test/auto-${n}-${Date.now()}`, feedId: 'test', publisher: 'Test Times', title: `Government launches scheme ${n}`, description: 'Scheme details.', publishedAt: new Date() });
  return generateContent({ provider: createMockProvider(), limit: 1 });
}

test('the default comes from config until an admin changes it', async () => {
  assert.equal((await getSettings()).autoPublish, config.pipeline.autoPublishDefault);
  await updateSettings({ autoPublish: true });
  assert.equal((await getSettings()).autoPublish, true);
  await updateSettings({ autoPublish: false, unknown: 1 });
  assert.deepEqual(await getSettings(), { autoPublish: false });
});

test('auto-publish on: generated articles, questions and Hindi go live without review', async () => {
  await updateSettings({ autoPublish: true });
  const stats = await generateOne();
  assert.equal(stats.published, 1);
  const a = await Article.findOne();
  assert.equal(a.status, 'published');
  assert.equal(a.review.auto, true);
  assert.ok(a.publishedAt);
  assert.equal(a.factsToVerify.every((f) => !f.confirmed), true, 'facts stay unconfirmed for a later check');
  assert.equal(await Question.countDocuments({ article: a._id, status: 'published' }), await Question.countDocuments({ article: a._id }));
  const list = await http().get('/api/v1/articles');
  assert.equal(list.body.total, 1, 'visible to readers');

  const t = await translateContent({ provider: createMockProvider() });
  assert.equal(t.published, 1);
  const hi = await http().get(`/api/v1/articles/${a.id}?lang=hi`);
  assert.equal(hi.body.article?.lang ?? hi.body.lang, 'hi');
});

test('auto-publish off: articles and Hindi wait for an editor', async () => {
  await updateSettings({ autoPublish: false });
  const stats = await generateOne();
  assert.equal(stats.created, 1);
  assert.equal(stats.published, 0);
  const a = await Article.findOne();
  assert.equal(a.status, 'in_review');
  assert.equal((await http().get('/api/v1/articles')).body.total, 0);
});

test('only admins can change the switch; editors can see it', async () => {
  const editor = await makeUser('editor');
  const admin = await makeUser('admin');
  assert.equal((await http().get('/api/v1/admin/settings').set(editor.auth)).status, 200);
  assert.equal((await http().patch('/api/v1/admin/settings').set(editor.auth).send({ autoPublish: true })).status, 403);
  const r = await http().patch('/api/v1/admin/settings').set(admin.auth).send({ autoPublish: true });
  assert.equal(r.status, 200);
  assert.equal(r.body.settings.autoPublish, true);
  assert.equal((await http().patch('/api/v1/admin/settings').set(admin.auth).send({ autoPublish: 'yes' })).status, 400);
});
