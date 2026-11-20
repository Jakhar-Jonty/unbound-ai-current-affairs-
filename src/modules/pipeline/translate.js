'use strict';
const { getSetting } = require('../settings/settings');
const config = require('../../config');
const { Article } = require('../content/article.model');
const { Question } = require('../quiz/question.model');
const { createProvider } = require('./ai');
const { isRateLimit } = require('./generate');
const { translationNeeds } = require('../content/i18n');
const {
  TRANSLATE_PROMPT_VERSION, TRANSLATE_SYSTEM_PROMPT, translationJsonSchema, buildTranslatePrompt, validateTranslation,
} = require('./translatePrompts');

const MAX_ATTEMPTS = 3;

/**
 * Published articles whose Hindi is missing or older than the English (article
 * text or any published question), excluding ones that failed MAX_ATTEMPTS times on
 * their current version.
 */
async function findCandidates(limit) {
  const staleArticles = await Article.find({
    status: 'published',
    $or: [{ 'translations.hi': { $exists: false } }, { $expr: { $ne: ['$translations.hi.sourceVersion', '$version'] } }],
  }).select('_id version translationErrors').sort({ publishedAt: -1 }).limit(limit * 3).lean();

  const staleQuestionArticles = await Question.aggregate([
    { $match: { status: 'published', article: { $ne: null } } },
    { $match: { $or: [{ 'translations.hi': { $exists: false } }, { $expr: { $ne: ['$translations.hi.sourceVersion', '$version'] } }] } },
    { $group: { _id: '$article' } },
    { $limit: limit * 3 },
  ]);
  const extra = await Article.find({ _id: { $in: staleQuestionArticles.map((r) => r._id) }, status: 'published' })
    .select('_id version translationErrors').lean();

  const seen = new Set();
  return [...staleArticles, ...extra].filter((a) => {
    const id = String(a._id);
    if (seen.has(id)) return false;
    seen.add(id);
    const e = a.translationErrors?.hi;
    return !(e && e.version === a.version && e.attempts >= MAX_ATTEMPTS);
  }).slice(0, limit);
}

/**
 * Translates whatever is out of date for one article (its text and/or questions)
 * and stores it for Hindi review. Returns 'translated' | 'up_to_date' | 'failed'.
 * Throws on rate limits so the caller can stop the run.
 */
async function translateArticle(articleId, { provider = createProvider() } = {}) {
  const article = await Article.findById(articleId);
  if (!article || article.status !== 'published') return 'up_to_date';
  const questions = await Question.find({ article: article._id, status: 'published' }).sort({ createdAt: 1 });
  const needs = translationNeeds(article, questions);
  if (!needs.article && !needs.questions.length) return 'up_to_date';

  const input = { article, includeArticle: needs.article, questions: needs.questions };
  try {
    const result = await provider.generateJSON({
      system: TRANSLATE_SYSTEM_PROMPT,
      prompt: buildTranslatePrompt(input),
      schema: translationJsonSchema({ includeArticle: needs.article }),
      schemaName: 'hindi_translation',
      context: { kind: 'translate', ...input },
    });
    const checked = validateTranslation(result.data, input);
    if (!checked.success) throw new Error(`Translation failed checks: ${checked.error}`);

    const generation = { provider: provider.name, model: result.model, promptVersion: TRANSLATE_PROMPT_VERSION, generatedAt: new Date() };
    if (checked.data.article) {
      article.set('translations.hi', { ...checked.data.article, status: 'in_review', sourceVersion: article.version, generation });
    }
    article.set('translationErrors.hi', undefined);
    await article.save();
    for (const t of checked.data.questions) {
      const q = needs.questions.find((x) => String(x._id) === String(t.id));
      await Question.updateOne(
        { _id: q._id, version: q.version },
        { $set: { 'translations.hi': { stem: t.stem, options: t.options, explanation: t.explanation, status: 'in_review', sourceVersion: q.version } } },
      );
    }
    // Auto-publish (admin setting): Hindi that passed the checks above goes live.
    if (await getSetting('autoPublish')) {
      await require('../admin/translation.service').publishHindi(article._id, {}).catch(() => {});
      return 'published';
    }
    return 'translated';
  } catch (err) {
    if (isRateLimit(err)) throw err;
    const prev = article.translationErrors?.hi;
    const attempts = prev && prev.version === article.version ? (prev.attempts || 0) + 1 : 1;
    await Article.updateOne(
      { _id: article._id },
      { $set: { 'translationErrors.hi': { message: String(err.message || err).slice(0, 1000), attempts, version: article.version, at: new Date() } } },
    );
    return 'failed';
  }
}

/** Job: translate up to `limit` articles into Hindi for review. Stops at the first rate limit. */
async function translateContent({ provider = createProvider(), limit = config.pipeline.translateBatchSize } = {}) {
  const candidates = await findCandidates(limit);
  const stats = { provider: provider.name, model: provider.model, candidates: candidates.length, translated: 0, failed: 0, rateLimited: false };
  for (const a of candidates) {
    try {
      const outcome = await translateArticle(a._id, { provider });
      if (outcome === 'translated' || outcome === 'published') stats.translated += 1;
      if (outcome === 'published') stats.published = (stats.published || 0) + 1;
      if (outcome === 'failed') stats.failed += 1;
    } catch (err) {
      if (!isRateLimit(err)) throw err;
      stats.rateLimited = true;
      break;
    }
  }
  return stats;
}

module.exports = { translateContent, translateArticle, findCandidates, MAX_ATTEMPTS };
