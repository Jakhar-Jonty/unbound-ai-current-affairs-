'use strict';
const { RawItem } = require('../src/modules/pipeline/rawItem.model');
const { generateContent } = require('../src/modules/pipeline/generate');
const { createMockProvider } = require('../src/modules/pipeline/ai/mock');
const { Article } = require('../src/modules/content/article.model');
const { approveArticle } = require('../src/modules/admin/editorial.service');

let n = 0;
/** Generates `count` in-review articles through the real pipeline (mock AI). */
async function generateArticles(count = 1) {
  const docs = Array.from({ length: count }, () => {
    n += 1;
    return { url: `https://news.test/item-${n}-${Date.now()}`, feedId: 'test', publisher: 'Test Times', title: `Government launches scheme number ${n}`, description: 'Scheme details.', publishedAt: new Date() };
  });
  await RawItem.create(docs);
  await generateContent({ provider: createMockProvider(), limit: count });
  return Article.find({ 'sources.url': { $in: docs.map((d) => d.url) } });
}

/** Generates and publishes `count` articles (and their questions). */
async function publishedArticles(count, userId) {
  const articles = await generateArticles(count);
  for (const a of articles) {
    await approveArticle(a._id, { userId, confirmedFacts: a.factsToVerify.map((_, i) => i) });
  }
  return Article.find({ _id: { $in: articles.map((a) => a._id) } });
}

module.exports = { generateArticles, publishedArticles };
