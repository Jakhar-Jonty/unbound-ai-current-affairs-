'use strict';
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setupDb, teardownDb, clearDb, rss, fakeFetch } = require('./helpers');
const { ingestFeeds, parseFeed } = require('../src/modules/pipeline/ingest');
const { generateContent } = require('../src/modules/pipeline/generate');
const { createMockProvider } = require('../src/modules/pipeline/ai/mock');
const { RawItem } = require('../src/modules/pipeline/rawItem.model');
const { Article } = require('../src/modules/content/article.model');
const { Question } = require('../src/modules/quiz/question.model');

before(() => setupDb(__filename));
after(teardownDb);
beforeEach(clearDb);

const FEED = { id: 'test', publisher: 'Test Times', url: 'https://feeds.test/rss' };

test('parses RSS and Atom feeds', () => {
  const items = parseFeed(rss([{ title: 'Cabinet approves &amp; scheme', url: 'https://n.test/a' }]));
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'Cabinet approves & scheme');
  const atom = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Atom item</title>
    <link rel="alternate" href="https://n.test/atom"/><summary>&lt;p&gt;Hello&lt;/p&gt;</summary><updated>${new Date().toISOString()}</updated></entry></feed>`;
  const a = parseFeed(atom);
  assert.equal(a[0].url, 'https://n.test/atom');
  assert.equal(a[0].description, 'Hello');
});

test('ingest stores new items once and ignores old ones', async () => {
  const old = new Date(Date.now() - 10 * 24 * 3600 * 1000);
  const fetchImpl = fakeFetch({
    [FEED.url]: rss([
      { title: 'RBI keeps repo rate unchanged', url: 'https://n.test/1' },
      { title: 'New tiger reserve notified', url: 'https://n.test/2' },
      { title: 'Ancient news', url: 'https://n.test/old', publishedAt: old },
    ]),
  });
  const s1 = await ingestFeeds({ feeds: [FEED, { id: 'broken', url: 'https://feeds.test/missing' }], fetchImpl });
  assert.equal(s1.inserted, 2);
  assert.equal(s1.tooOld, 1);
  assert.equal(s1.feedErrors.length, 1, 'a broken feed is reported, not fatal');
  const s2 = await ingestFeeds({ feeds: [FEED], fetchImpl });
  assert.equal(s2.inserted, 0, 'second run inserts nothing');
  assert.equal(await RawItem.countDocuments(), 2);
});

test('generate creates in-review articles and questions with provenance', async () => {
  await RawItem.create([
    { url: 'https://n.test/1', feedId: 'test', publisher: 'Test Times', title: 'Parliament passes data protection amendment', description: 'Details', publishedAt: new Date() },
    { url: 'https://n.test/2', feedId: 'test', title: 'Film star launches perfume [irrelevant]', publishedAt: new Date() },
  ]);
  const stats = await generateContent({ provider: createMockProvider(), limit: 10, concurrency: 2 });
  assert.equal(stats.claimed, 2);
  assert.equal(stats.created, 1);
  assert.equal(stats.skipped, 1);

  const article = await Article.findOne().select('+generation.rawOutput');
  assert.equal(article.status, 'in_review', 'nothing is published without review');
  assert.equal(article.sources[0].url, 'https://n.test/1');
  assert.equal(article.generation.provider, 'mock');
  assert.ok(article.generation.promptVersion);
  assert.ok(article.generation.rawOutput);
  assert.ok(article.factsToVerify.length > 0);
  const qs = await Question.find({ article: article._id });
  assert.equal(qs.length, 2);
  assert.ok(qs.every((q) => q.status === 'in_review'));

  const skipped = await RawItem.findOne({ url: 'https://n.test/2' });
  assert.equal(skipped.status, 'skipped');

  const again = await generateContent({ provider: createMockProvider() });
  assert.equal(again.claimed, 0, 'processed items are not picked up again');
});

test('failures are retried and then marked failed', async () => {
  await RawItem.create({ url: 'https://n.test/f', feedId: 'test', title: 'Broken item [fail]', publishedAt: new Date() });
  const provider = createMockProvider();
  assert.equal((await generateContent({ provider, maxAttempts: 2 })).retry, 1);
  let item = await RawItem.findOne();
  assert.equal(item.status, 'new');
  assert.match(item.lastError, /Mock provider failure/);
  assert.equal((await generateContent({ provider, maxAttempts: 2 })).failed, 1);
  item = await RawItem.findOne();
  assert.equal(item.status, 'failed');
  assert.equal(await Article.countDocuments(), 0);
});

test('invalid AI output is rejected, not stored', async () => {
  await RawItem.create({ url: 'https://n.test/bad', feedId: 'test', title: 'Some policy news', publishedAt: new Date() });
  const provider = {
    name: 'bad', model: 'bad-1',
    async generateJSON() {
      const data = { relevant: true, relevanceReason: 'x', title: 'Some policy news', summary: 'A summary that is long enough.', body: 'b'.repeat(60), keyPoints: ['k'], upscRelevance: 'Relevant to GS2', gsPaper: 'GS2', subjects: ['polity'], keywords: [], factsToVerify: [], questions: [{ stem: 'A question stem here?', options: ['a', 'b', 'c'], correctIndex: 5, explanation: 'Because reasons.', difficulty: 'easy' }] };
      return { data, raw: JSON.stringify(data), model: 'bad-1' };
    },
  };
  const stats = await generateContent({ provider });
  assert.equal(stats.retry, 1);
  assert.match((await RawItem.findOne()).lastError, /failed validation/);
  assert.equal(await Article.countDocuments(), 0);
});

test('stale processing items are recovered and duplicate sources are skipped', async () => {
  await RawItem.create({ url: 'https://n.test/s', feedId: 'test', title: 'Stale item', status: 'processing', processingStartedAt: new Date(Date.now() - 3600 * 1000), publishedAt: new Date() });
  const s = await generateContent({ provider: createMockProvider() });
  assert.equal(s.recovered, 1);
  assert.equal(s.created, 1);

  await RawItem.updateOne({ url: 'https://n.test/s' }, { $set: { status: 'new' } });
  const s2 = await generateContent({ provider: createMockProvider() });
  assert.equal(s2.skipped, 1);
  assert.equal(await Article.countDocuments(), 1);
});
