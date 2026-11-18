'use strict';
const { Article } = require('../content/article.model');
const { Question } = require('../quiz/question.model');
const { isCurrent } = require('../content/i18n');
const { missingNumbers, paragraphs } = require('../pipeline/translatePrompts');
const { translateArticle } = require('../pipeline/translate');
const { isRateLimit } = require('../pipeline/generate');
const { AppError, badRequest, conflict, notFound } = require('../../lib/errors');

async function load(id) {
  const article = await Article.findById(id);
  if (!article) throw notFound('Article not found');
  const questions = await Question.find({ article: article._id, status: 'published' }).sort({ createdAt: 1 });
  return { article, questions };
}

/** Hindi status of one article for the admin panel, with automatic number checks. */
function hindiSummary(article, questions) {
  const a = article.translations?.hi;
  const warnings = [];
  if (a && isCurrent(article, 'hi')) {
    for (const f of ['title', 'summary', 'body', 'upscRelevance']) {
      const miss = missingNumbers(article[f] || '', a[f] || '');
      if (miss.length) warnings.push(`Article ${f}: ${miss.join(', ')} missing in Hindi`);
    }
    if ((a.keyPoints || []).length !== (article.keyPoints || []).length) warnings.push('Key points: different number of points than English');
    if (paragraphs(a.body).length !== paragraphs(article.body).length) warnings.push(`Explainer: ${paragraphs(a.body).length} paragraphs in Hindi, ${paragraphs(article.body).length} in English (paragraphs may be merged)`);
  }
  for (const q of questions) {
    const t = q.translations?.hi;
    if (!t || !isCurrent(q, 'hi')) continue;
    if ((t.options || []).length !== q.options.length) warnings.push(`Question “${q.stem.slice(0, 40)}…”: option count differs`);
    q.options.forEach((o, i) => {
      if (missingNumbers(o, t.options?.[i] || '').length) warnings.push(`Question “${q.stem.slice(0, 40)}…”: option ${String.fromCharCode(65 + i)} numbers differ`);
    });
  }
  const pieceState = (doc) => {
    const t = doc.translations?.hi;
    if (!t) return 'missing';
    if (!isCurrent(doc, 'hi')) return 'outdated';
    return t.status; // in_review | published
  };
  return {
    article: pieceState(article),
    questions: questions.map((q) => ({ id: q._id, state: pieceState(q) })),
    error: article.translationErrors?.hi?.version === article.version ? article.translationErrors.hi : null,
    warnings,
  };
}

/** Publishes every current Hindi piece in review. The English must be published and its Hindi text must exist. */
async function publishHindi(id, { userId }) {
  const { article, questions } = await load(id);
  if (article.status !== 'published') throw conflict('Publish the English article first');
  if (!isCurrent(article, 'hi')) throw badRequest('The Hindi text is missing or older than the English. Translate it again first.');
  const now = new Date();
  let published = 0;
  if (article.translations.hi.status === 'in_review') {
    article.set('translations.hi.status', 'published');
    article.set('translations.hi.reviewedBy', userId);
    article.set('translations.hi.publishedAt', now);
    await article.save();
    published += 1;
  }
  for (const q of questions) {
    if (isCurrent(q, 'hi') && q.translations.hi.status === 'in_review') {
      await Question.updateOne({ _id: q._id, version: q.version }, { $set: { 'translations.hi.status': 'published' } });
      published += 1;
    }
  }
  if (!published) throw conflict('Nothing in Hindi is waiting for review');
  const pendingQuestions = questions.filter((q) => !isCurrent(q, 'hi')).length;
  return { article, published, pendingQuestions };
}

/** Editor fixes to the Hindi article text. Keeps its review status. */
async function editHindiArticle(id, changes) {
  const article = await Article.findById(id);
  if (!article) throw notFound('Article not found');
  if (!isCurrent(article, 'hi')) throw badRequest('There is no current Hindi text to edit. Translate it first.');
  if (changes.keyPoints && changes.keyPoints.length !== (article.keyPoints || []).length) {
    throw badRequest(`Hindi needs ${(article.keyPoints || []).length} key points, the same as English`);
  }
  for (const [k, v] of Object.entries(changes)) article.set(`translations.hi.${k}`, v);
  article.set('translations.hi.edited', true);
  await article.save();
  return article;
}

async function editHindiQuestion(id, changes) {
  const q = await Question.findById(id);
  if (!q) throw notFound('Question not found');
  if (!isCurrent(q, 'hi')) throw badRequest('There is no current Hindi text for this question. Translate it first.');
  if (changes.options && changes.options.length !== q.options.length) throw badRequest(`Hindi needs ${q.options.length} options in the same order as English`);
  for (const [k, v] of Object.entries(changes)) q.set(`translations.hi.${k}`, v);
  q.set('translations.hi.edited', true);
  await q.save();
  return q;
}

/** Discards Hindi waiting for review (and any failure) and translates again now. */
async function retranslate(id, { provider } = {}) {
  const { article, questions } = await load(id);
  if (article.status !== 'published') throw conflict('Publish the English article first');
  if (article.translations?.hi?.status === 'in_review') article.set('translations.hi', undefined);
  article.set('translationErrors.hi', undefined);
  await article.save();
  await Question.updateMany(
    { _id: { $in: questions.map((q) => q._id) }, 'translations.hi.status': 'in_review' },
    { $unset: { 'translations.hi': '' } },
  );
  try {
    return await translateArticle(article._id, provider ? { provider } : {});
  } catch (err) {
    if (isRateLimit(err)) throw new AppError(503, 'rate_limited', 'The AI provider is busy (rate limit). Try again in a minute.');
    throw err;
  }
}

/** Articles for the Hindi tab: waiting for review, failed, or published but Hindi missing/outdated. */
async function listForReview(status) {
  if (status === 'failed') {
    return Article.find({ status: 'published', 'translationErrors.hi': { $exists: true }, $expr: { $eq: ['$translationErrors.hi.version', '$version'] } })
      .sort({ 'translationErrors.hi.at': -1 }).limit(100).lean();
  }
  if (status === 'pending') {
    return Article.find({ status: 'published', $or: [{ 'translations.hi': { $exists: false } }, { $expr: { $ne: ['$translations.hi.sourceVersion', '$version'] } }] })
      .sort({ publishedAt: -1 }).limit(100).lean();
  }
  const withQuestions = await Question.distinct('article', { status: 'published', 'translations.hi.status': 'in_review' });
  return Article.find({
    status: 'published',
    $or: [
      { 'translations.hi.status': 'in_review', $expr: { $eq: ['$translations.hi.sourceVersion', '$version'] } },
      { _id: { $in: withQuestions } },
    ],
  }).sort({ publishedAt: -1 }).limit(100).lean();
}

module.exports = { hindiSummary, publishHindi, editHindiArticle, editHindiQuestion, retranslate, listForReview };
