'use strict';
const config = require('../../config');
const { RawItem } = require('./rawItem.model');
const { Article } = require('../content/article.model');
const { Question } = require('../quiz/question.model');
const { uniqueSlug } = require('../content/content.service');
const { createProvider } = require('./ai');
const { PROMPT_VERSION, SYSTEM_PROMPT, buildUserPrompt, OUTPUT_JSON_SCHEMA, generatedOutput } = require('./prompts');
const { fetchText } = require('./ingest');
const { extractArticleText } = require('../../lib/text');
const { mapWithConcurrency } = require('../../lib/pool');

const STALE_PROCESSING_MS = 30 * 60 * 1000;

/** Atomically claims up to `limit` new items so two runs can never process the same item. */
async function claimBatch(limit) {
  const claimed = [];
  for (let i = 0; i < limit; i += 1) {
    const item = await RawItem.findOneAndUpdate(
      { status: 'new' },
      { $set: { status: 'processing', processingStartedAt: new Date() }, $inc: { attempts: 1 } },
      { sort: { publishedAt: -1 }, returnDocument: 'after' },
    );
    if (!item) break;
    claimed.push(item);
  }
  return claimed;
}

/** Items stuck in "processing" (e.g. the worker crashed) go back to the queue. */
async function recoverStale() {
  const r = await RawItem.updateMany(
    { status: 'processing', processingStartedAt: { $lt: new Date(Date.now() - STALE_PROCESSING_MS) } },
    { $set: { status: 'new' } },
  );
  return r.modifiedCount;
}

async function loadFullText(item, fetchImpl) {
  if (!config.pipeline.fetchFullText) return '';
  try {
    return extractArticleText(await fetchText(item.url, { fetchImpl, timeoutMs: 15000 }));
  } catch {
    return ''; // Fall back to the feed summary.
  }
}

async function processItem(item, { provider, fetchImpl, maxAttempts }) {
  try {
    // A second feed may carry the same story URL; never create duplicate content.
    const existing = await Article.findOne({ 'sources.url': item.url }).select('_id').lean();
    if (existing) {
      await RawItem.updateOne({ _id: item._id }, { $set: { status: 'skipped', skipReason: 'duplicate_source', article: existing._id } });
      return 'skipped';
    }

    const fullText = await loadFullText(item, fetchImpl);
    const source = { ...item.toObject(), fullText };
    const result = await provider.generateJSON({
      system: SYSTEM_PROMPT,
      prompt: buildUserPrompt(source),
      schema: OUTPUT_JSON_SCHEMA,
      schemaName: 'current_affairs_item',
      context: { item: source },
    });

    const parsed = generatedOutput.safeParse(result.data);
    if (!parsed.success) {
      throw new Error(`AI output failed validation: ${parsed.error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
    }
    const out = parsed.data;

    if (!out.relevant) {
      await RawItem.updateOne({ _id: item._id }, { $set: { status: 'skipped', skipReason: out.relevanceReason || 'not_relevant' } });
      return 'skipped';
    }

    const generation = {
      provider: provider.name,
      model: result.model,
      promptVersion: PROMPT_VERSION,
      rawItemIds: [item._id],
      generatedAt: new Date(),
      rawOutput: result.raw,
    };
    const article = await Article.create({
      slug: await uniqueSlug(out.title),
      title: out.title,
      summary: out.summary,
      body: out.body,
      keyPoints: out.keyPoints,
      upscRelevance: out.upscRelevance,
      tags: { gsPaper: out.gsPaper, subjects: out.subjects, keywords: out.keywords },
      sources: [{ url: item.url, publisher: item.publisher, title: item.title, publishedAt: item.publishedAt, excerpt: (fullText || item.description || '').slice(0, 1500) }],
      factsToVerify: out.factsToVerify.map((text) => ({ text })),
      status: 'in_review',
      eventDate: item.publishedAt,
      generation,
    });
    await Question.insertMany(
      out.questions.map((q) => ({
        article: article._id,
        stem: q.stem,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        difficulty: q.difficulty,
        tags: { gsPaper: out.gsPaper, subjects: out.subjects },
        status: 'in_review',
        generation: { provider: provider.name, model: result.model, promptVersion: PROMPT_VERSION },
      })),
    );
    await RawItem.updateOne({ _id: item._id }, { $set: { status: 'processed', article: article._id, lastError: null } });
    return 'created';
  } catch (err) {
    const failed = item.attempts >= maxAttempts;
    await RawItem.updateOne(
      { _id: item._id },
      { $set: { status: failed ? 'failed' : 'new', lastError: String(err.message || err).slice(0, 1000) } },
    );
    return failed ? 'failed' : 'retry';
  }
}

/**
 * Turns queued feed items into draft articles + questions, sent to the editor review
 * queue (status in_review). Nothing generated here is visible to users until approved.
 */
async function generateContent({
  provider = createProvider(),
  limit = config.pipeline.batchSize,
  concurrency = config.pipeline.concurrency,
  maxAttempts = config.pipeline.maxAttempts,
  fetchImpl = fetch,
} = {}) {
  const recovered = await recoverStale();
  const items = await claimBatch(limit);
  const outcomes = await mapWithConcurrency(items, concurrency, (item) => processItem(item, { provider, fetchImpl, maxAttempts }));
  const count = (k) => outcomes.filter((o) => o === k).length;
  return {
    provider: provider.name,
    model: provider.model,
    claimed: items.length,
    created: count('created'),
    skipped: count('skipped'),
    retry: count('retry'),
    failed: count('failed'),
    recovered,
  };
}

module.exports = { generateContent, claimBatch, recoverStale };
