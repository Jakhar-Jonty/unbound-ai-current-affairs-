'use strict';
const config = require('../../config');
const { RawItem } = require('./rawItem.model');
const { Article } = require('../content/article.model');
const { Question } = require('../quiz/question.model');
const { uniqueSlug } = require('../content/content.service');
const { createProvider } = require('./ai');
const { PROMPT_VERSION, SYSTEM_PROMPT, buildUserPrompt, OUTPUT_JSON_SCHEMA, withArrayBounds, parseGeneratedOutput } = require('./prompts');
const { fetchText } = require('./ingest');
const { extractArticleText } = require('../../lib/text');
const { mapWithConcurrency } = require('../../lib/pool');

const STALE_PROCESSING_MS = 30 * 60 * 1000;
const MAX_SOURCES_PER_PROMPT = 4;

const stamp = () => ({ status: 'processing', processingStartedAt: new Date() });

/**
 * Atomically claims up to `limit` stories. For each, the lead item and every other
 * queued item in the same story are claimed together, so a story is written once.
 */
async function claimBatch(limit) {
  const stories = [];
  for (let i = 0; i < limit; i += 1) {
    const set = stamp();
    const lead = await RawItem.findOneAndUpdate(
      { status: 'new' },
      { $set: set, $inc: { attempts: 1 } },
      { sort: { publishedAt: -1 }, returnDocument: 'after' },
    );
    if (!lead) break;
    let items = [lead];
    if (lead.storyKey) {
      await RawItem.updateMany(
        { storyKey: lead.storyKey, status: 'new' },
        { $set: { status: 'processing', processingStartedAt: set.processingStartedAt }, $inc: { attempts: 1 } },
      );
      items = await RawItem.find({ storyKey: lead.storyKey, status: 'processing', processingStartedAt: set.processingStartedAt })
        .sort({ publishedAt: 1 });
    }
    stories.push(items);
  }
  return stories;
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

const OFFICIAL = /press information bureau|\bpib\b|ministry|reserve bank|\brbi\b|sebi|supreme court|high court|lok sabha|rajya sabha|election commission|niti aayog/i;

/** Official sources first, then the ones with the most text. */
function rankSources(items) {
  return [...items].sort((a, b) => (OFFICIAL.test(b.publisher || '') - OFFICIAL.test(a.publisher || ''))
    || ((b.fullText || b.description || '').length - (a.fullText || a.description || '').length));
}

const toSource = (item, extra = {}) => ({
  url: item.url,
  publisher: item.publisher,
  title: item.title,
  publishedAt: item.publishedAt,
  excerpt: (item.fullText || item.description || '').slice(0, 1500),
  ...extra,
});

async function markItems(items, set) {
  await RawItem.updateMany({ _id: { $in: items.map((i) => i._id) } }, { $set: set });
}

/**
 * If an article already exists for this story (or shares a source URL), new
 * coverage is added to it while it is still in review. Published, rejected and
 * retracted articles are never changed by the pipeline.
 */
async function handleExistingStory(items, fetchImpl) {
  const storyKey = items[0].storyKey;
  const urls = items.map((i) => i.url);
  let existing = await Article.findOne({
    $or: [{ 'sources.url': { $in: urls } }, ...(storyKey ? [{ storyKey }] : [])],
  }).sort({ createdAt: 1 });
  if (!existing) return null;
  // A merged duplicate points at the article that now holds the story.
  for (let hops = 0; existing?.mergedInto && hops < 5; hops += 1) existing = await Article.findById(existing.mergedInto);
  if (!existing) return null;

  const known = new Set(existing.sources.map((src) => src.url));
  const fresh = items.filter((i) => !known.has(i.url));
  if (!fresh.length) {
    await markItems(items, { status: 'skipped', skipReason: 'duplicate_source', article: existing._id });
    return 'skipped';
  }
  if (!['in_review', 'draft'].includes(existing.status)) {
    // Published, retracted or rejected by an editor: don't change it or bring the story back.
    await markItems(items, { status: 'skipped', skipReason: `already_covered_${existing.status}`, article: existing._id });
    return 'skipped';
  }
  const now = new Date();
  for (const item of fresh) {
    const fullText = await loadFullText(item, fetchImpl);
    existing.sources.push(toSource({ ...item.toObject(), fullText }, { addedLater: true, addedAt: now }));
    existing.generation.rawItemIds.push(item._id);
  }
  if (!existing.storyKey && storyKey) existing.storyKey = storyKey;
  await existing.save();
  await markItems(fresh, { status: 'processed', article: existing._id, attachedLater: true, lastError: null });
  await markItems(items.filter((i) => known.has(i.url)), { status: 'skipped', skipReason: 'duplicate_source', article: existing._id });
  return 'attached';
}

async function processStory(items, { provider, fetchImpl, maxAttempts }) {
  try {
    const handled = await handleExistingStory(items, fetchImpl);
    if (handled) return handled;

    const withText = await Promise.all(items.map(async (i) => ({ ...i.toObject(), fullText: await loadFullText(i, fetchImpl) })));
    const ranked = rankSources(withText);
    const promptSources = ranked.slice(0, MAX_SOURCES_PER_PROMPT);
    const result = await provider.generateJSON({
      system: SYSTEM_PROMPT,
      prompt: buildUserPrompt(promptSources),
      schema: provider.supportsArrayBounds ? withArrayBounds(OUTPUT_JSON_SCHEMA) : OUTPUT_JSON_SCHEMA,
      schemaName: 'current_affairs_item',
      context: { item: promptSources[0], items: promptSources },
    });

    const parsed = parseGeneratedOutput(result.data);
    if (!parsed.success) throw new Error(`AI output failed validation: ${parsed.error}`);
    const out = parsed.data;

    if (!out.relevant) {
      await markItems(items, { status: 'skipped', skipReason: out.relevanceReason || 'not_relevant' });
      return 'skipped';
    }

    const generation = {
      provider: provider.name,
      model: result.model,
      promptVersion: PROMPT_VERSION,
      rawItemIds: items.map((i) => i._id),
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
      sources: ranked.map((src) => toSource(src)),
      factsToVerify: out.factsToVerify.map((text) => ({ text })),
      status: 'in_review',
      eventDate: items.map((i) => i.publishedAt).filter(Boolean).sort((a, b) => a - b)[0],
      storyKey: items[0].storyKey,
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
    await markItems(items, { status: 'processed', article: article._id, lastError: null });
    return 'created';
  } catch (err) {
    const message = String(err.message || err).slice(0, 1000);
    let failed = false;
    for (const item of items) {
      const isFailed = item.attempts >= maxAttempts;
      failed = failed || isFailed;
      await RawItem.updateOne({ _id: item._id }, { $set: { status: isFailed ? 'failed' : 'new', lastError: message } });
    }
    return failed ? 'failed' : 'retry';
  }
}

/**
 * Turns queued stories into draft articles + questions in the editor review queue
 * (status in_review). Nothing generated here is visible to users until approved.
 * `limit` is the number of stories per run; each story may contain several items.
 */
async function generateContent({
  provider = createProvider(),
  limit = config.pipeline.batchSize,
  concurrency = config.pipeline.concurrency,
  maxAttempts = config.pipeline.maxAttempts,
  fetchImpl = fetch,
} = {}) {
  const recovered = await recoverStale();
  const stories = await claimBatch(limit);
  const outcomes = await mapWithConcurrency(stories, concurrency, (items) => processStory(items, { provider, fetchImpl, maxAttempts }));
  const count = (k) => outcomes.filter((o) => o === k).length;
  return {
    provider: provider.name,
    model: provider.model,
    stories: stories.length,
    claimed: stories.reduce((n, st) => n + st.length, 0),
    created: count('created'),
    attached: count('attached'),
    skipped: count('skipped'),
    retry: count('retry'),
    failed: count('failed'),
    recovered,
  };
}

module.exports = { generateContent, claimBatch, recoverStale, rankSources };
