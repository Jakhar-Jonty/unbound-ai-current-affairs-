'use strict';
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setupDb, teardownDb, clearDb, http, makeUser, rss, fakeFetch } = require('./helpers');
const { similarTo } = require('../src/modules/pipeline/similarity');
const { ingestFeeds } = require('../src/modules/pipeline/ingest');
const { generateContent, rankSources } = require('../src/modules/pipeline/generate');
const { createMockProvider } = require('../src/modules/pipeline/ai/mock');
const { RawItem } = require('../src/modules/pipeline/rawItem.model');
const { Article } = require('../src/modules/content/article.model');
const { Question } = require('../src/modules/quiz/question.model');

before(() => setupDb(__filename));
after(teardownDb);
beforeEach(clearDb);

const pair = (a, b) => similarTo({ title: a[0], description: a[1] }, [{ title: b[0], description: b[1] }]).length === 1;

test('matcher groups the same event and keeps different events apart', () => {
  // Same event, different outlets.
  assert.ok(pair(
    ['RBI keeps repo rate unchanged at 6.5% for eighth straight time', 'The Monetary Policy Committee of the Reserve Bank of India voted to keep the repo rate unchanged at 6.5 per cent.'],
    ['Monetary policy: RBI holds repo rate steady at 6.5 per cent', 'The Reserve Bank of India left its key lending rate unchanged on Friday as inflation stays above target.'],
  ));
  assert.ok(pair(
    ['IMD issues heatwave warning for Rajasthan, Gujarat', 'The IMD warned of severe heatwave conditions in Rajasthan and Gujarat over the next three days.'],
    ['Heatwave alert issued for Rajasthan and Gujarat', 'The India Meteorological Department issued a heatwave alert for several districts.'],
  ));
  // Different events that share words.
  assert.ok(!pair(
    ['RBI keeps repo rate unchanged at 6.5%', 'The Monetary Policy Committee kept the repo rate unchanged.'],
    ['RBI imposes monetary penalty on two cooperative banks', 'The Reserve Bank of India has imposed penalties on two cooperative banks.'],
  ));
  assert.ok(!pair(
    ['Cabinet approves PM-Surya Ghar Muft Bijli Yojana', 'The Union Cabinet approved the rooftop solar scheme for one crore households.'],
    ['Cabinet approves extension of PM Garib Kalyan Anna Yojana', 'The Union Cabinet approved free foodgrains under PMGKAY for five more years.'],
  ));
  assert.ok(!pair(
    ['India, Japan sign pact on semiconductor supply chains', 'India and Japan signed a memorandum on semiconductor supply chains.'],
    ['India, Japan hold 2+2 dialogue on defence ties', 'India and Japan held the 2+2 ministerial dialogue on defence cooperation.'],
  ));
});

test('official sources are listed first', () => {
  const ranked = rankSources([
    { publisher: 'The Hindu', description: 'long '.repeat(50) },
    { publisher: 'Press Information Bureau', description: 'short' },
  ]);
  assert.equal(ranked[0].publisher, 'Press Information Bureau');
});

const FEED_A = { id: 'a', publisher: 'The Hindu', url: 'https://a.test/rss' };
const FEED_B = { id: 'b', publisher: 'Press Information Bureau', url: 'https://b.test/rss' };

test('items about the same event from different feeds become one article with all sources', async () => {
  const fetchImpl = fakeFetch({
    [FEED_A.url]: rss([
      { title: 'RBI keeps repo rate unchanged at 6.5% for eighth straight time', url: 'https://a.test/rbi', description: 'The Monetary Policy Committee of the Reserve Bank of India voted to keep the repo rate unchanged at 6.5 per cent.' },
      { title: 'New tiger reserve notified in Madhya Pradesh', url: 'https://a.test/tiger', description: 'The state notified a new tiger reserve.' },
    ]),
    [FEED_B.url]: rss([
      { title: 'Monetary policy: RBI holds repo rate steady at 6.5 per cent', url: 'https://b.test/rbi', description: 'The Reserve Bank of India left its key lending rate unchanged as inflation stays above target.' },
    ]),
  });
  const ing = await ingestFeeds({ feeds: [FEED_A, FEED_B], fetchImpl });
  assert.equal(ing.inserted, 3);
  assert.equal(ing.grouped, 1);
  const rbi = await RawItem.find({ url: /rbi/ });
  assert.equal(String(rbi[0].storyKey), String(rbi[1].storyKey));
  const tiger = await RawItem.findOne({ url: /tiger/ });
  assert.notEqual(String(tiger.storyKey), String(rbi[0].storyKey));

  let prompt;
  const base = createMockProvider();
  const provider = { ...base, generateJSON: (args) => { if (args.context.items.length > 1) prompt = args.prompt; return base.generateJSON(args); } };
  const s = await generateContent({ provider, limit: 10 });
  assert.equal(s.stories, 2);
  assert.equal(s.claimed, 3);
  assert.equal(s.created, 2);
  assert.match(prompt, /These 2 reports cover the same event/);

  const article = await Article.findOne({ 'sources.url': 'https://a.test/rbi' });
  assert.equal(article.sources.length, 2);
  assert.equal(article.sources[0].publisher, 'Press Information Bureau', 'official source first');
  assert.equal(article.generation.rawItemIds.length, 2);
  assert.equal(await Article.countDocuments(), 2);
  assert.ok((await RawItem.find({ url: /rbi/ })).every((r) => r.status === 'processed' && String(r.article) === String(article._id)));
});

test('later coverage is added to an article in review, but never changes a published one', async () => {
  const run = (items) => ingestFeeds({ feeds: [FEED_A], fetchImpl: fakeFetch({ [FEED_A.url]: rss(items) }) });
  await run([{ title: 'IMD issues heatwave warning for Rajasthan, Gujarat', url: 'https://a.test/heat1', description: 'The IMD warned of severe heatwave conditions in Rajasthan and Gujarat over the next three days.' }]);
  await generateContent({ provider: createMockProvider() });
  const article = await Article.findOne();
  assert.equal(article.sources.length, 1);

  await run([{ title: 'Heatwave alert issued for Rajasthan and Gujarat', url: 'https://a.test/heat2', description: 'The India Meteorological Department issued a heatwave alert for several districts in Rajasthan and Gujarat.' }]);
  const s = await generateContent({ provider: createMockProvider() });
  assert.equal(s.attached, 1);
  assert.equal(s.created, 0);
  const updated = await Article.findById(article._id);
  assert.equal(updated.sources.length, 2);
  assert.equal(updated.sources[1].addedLater, true);
  assert.equal((await RawItem.findOne({ url: 'https://a.test/heat2' })).attachedLater, true);

  // Publish it, then more coverage arrives: the published text is left alone.
  const editor = await makeUser('editor');
  await http().post(`/api/v1/admin/articles/${article._id}/approve`).set(editor.auth).send({ confirmedFacts: updated.factsToVerify.map((_, i) => i) });
  await run([{ title: 'Heatwave warning: IMD alert for Rajasthan, Gujarat districts', url: 'https://a.test/heat3', description: 'IMD heatwave alert for Rajasthan and Gujarat.' }]);
  const s2 = await generateContent({ provider: createMockProvider() });
  assert.equal(s2.skipped, 1);
  assert.equal((await Article.findById(article._id)).sources.length, 2);
  const late = await RawItem.findOne({ url: 'https://a.test/heat3' });
  assert.equal(late.skipReason, 'already_covered_published');
  assert.equal(String(late.article), String(article._id));
});

test('a story an editor rejected does not come back with new coverage', async () => {
  const editor = await makeUser('editor');
  const run = (items) => ingestFeeds({ feeds: [FEED_A], fetchImpl: fakeFetch({ [FEED_A.url]: rss(items) }) });
  await run([{ title: 'IMD issues heatwave warning for Rajasthan, Gujarat', url: 'https://a.test/h1', description: 'The IMD warned of severe heatwave conditions in Rajasthan and Gujarat.' }]);
  await generateContent({ provider: createMockProvider() });
  const article = await Article.findOne();
  await http().post(`/api/v1/admin/articles/${article._id}/reject`).set(editor.auth).send({ reason: 'Routine weather update' });
  await run([{ title: 'Heatwave alert issued for Rajasthan and Gujarat', url: 'https://a.test/h2', description: 'The India Meteorological Department issued a heatwave alert for Rajasthan and Gujarat.' }]);
  const s = await generateContent({ provider: createMockProvider() });
  assert.equal(s.created, 0);
  assert.equal((await RawItem.findOne({ url: 'https://a.test/h2' })).skipReason, 'already_covered_rejected');
  assert.equal(await Article.countDocuments(), 1);
});

test('editors see possible duplicates and can merge them', async () => {
  const editor = await makeUser('editor');
  const mk = (title, summary, url) => http().post('/api/v1/admin/articles').set(editor.auth).send({
    title, summary, body: `${summary} A longer explainer body that is long enough to pass validation for this article.`,
    tags: { gsPaper: 'GS2', subjects: ['polity'] }, sources: [{ url, publisher: 'Test' }], factsToVerify: [`Fact from ${url}`],
    questions: [{ stem: `Question about ${title}?`, options: ['A', 'B', 'C', 'D'], correctIndex: 0, explanation: 'Because A is right.' }],
  }).then((r) => r.body.article);
  const a = await mk('Union Cabinet clears One Nation One Election bill', 'The Union Cabinet cleared the bill on simultaneous elections.', 'https://x.test/1');
  const b = await mk('Cabinet approves One Nation One Election bill for Parliament', 'The Cabinet approved the One Nation One Election bill.', 'https://x.test/2');
  await mk('Supreme Court refuses to stay new criminal laws', 'The Supreme Court declined to stay the three new criminal laws.', 'https://x.test/3');

  const sim = await http().get(`/api/v1/admin/articles/${b._id}/similar`).set(editor.auth);
  assert.equal(sim.status, 200);
  assert.equal(sim.body.items[0]._id, a._id);
  assert.ok(!sim.body.items.some((i) => /criminal/.test(i.title)));

  const m = await http().post(`/api/v1/admin/articles/${b._id}/merge`).set(editor.auth).send({ intoId: a._id });
  assert.equal(m.status, 200);
  assert.equal(m.body.questionsMoved, 1);
  const target = await Article.findById(a._id);
  assert.deepEqual(target.sources.map((src) => src.url), ['https://x.test/1', 'https://x.test/2']);
  assert.equal(target.factsToVerify.length, 2);
  assert.ok(target.factsToVerify.every((f) => !f.confirmed));
  assert.equal(await Question.countDocuments({ article: a._id }), 2);
  const merged = await Article.findById(b._id);
  assert.equal(merged.status, 'rejected');
  assert.equal(String(merged.mergedInto), a._id);

  assert.equal((await http().post(`/api/v1/admin/articles/${a._id}/merge`).set(editor.auth).send({ intoId: b._id })).status, 409, 'cannot merge into a rejected article');
  assert.equal((await http().post(`/api/v1/admin/articles/${a._id}/merge`).set(editor.auth).send({ intoId: a._id })).status, 400);
});
