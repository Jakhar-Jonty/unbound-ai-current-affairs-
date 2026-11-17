'use strict';
const { Article } = require('../content/article.model');
const { Question } = require('../quiz/question.model');
const { recordRevision, uniqueSlug } = require('../content/content.service');
const { badRequest, conflict, notFound } = require('../../lib/errors');

async function getArticleOr404(id, { withRaw = false } = {}) {
  const q = Article.findById(id);
  if (withRaw) q.select('+generation.rawOutput');
  const article = await q;
  if (!article) throw notFound('Article not found');
  return article;
}

/**
 * Publishes an article and its pending questions. The editor must confirm every
 * fact the generator flagged (by index), and the article must cite a source.
 */
async function approveArticle(id, { userId, confirmedFacts = [], notes }) {
  const article = await getArticleOr404(id);
  if (!['in_review', 'draft'].includes(article.status)) throw conflict(`Cannot approve an article that is ${article.status}`);
  if (!article.sources.length) throw badRequest('An article needs at least one source before it can be published');

  const confirmed = new Set(confirmedFacts);
  const missing = article.factsToVerify.map((_, i) => i).filter((i) => !confirmed.has(i));
  if (missing.length) {
    throw badRequest('Confirm every flagged fact against the sources before publishing', { unconfirmedFacts: missing });
  }

  const pending = await Question.countDocuments({ article: article._id, status: { $in: ['in_review', 'draft', 'published'] } });
  if (!pending) throw badRequest('An article needs at least one approved question; add or restore one first');

  const now = new Date();
  article.factsToVerify.forEach((f) => { f.confirmed = true; });
  article.status = 'published';
  article.publishedAt = article.publishedAt || now;
  article.review = { reviewedBy: userId, reviewedAt: now, notes };
  await article.save();
  await recordRevision(article, { reason: 'published', userId });

  const q = await Question.updateMany(
    { article: article._id, status: { $in: ['in_review', 'draft'] } },
    { $set: { status: 'published', publishedAt: now } },
  );
  return { article, questionsPublished: q.modifiedCount };
}

async function rejectArticle(id, { userId, reason }) {
  const article = await getArticleOr404(id);
  if (!['in_review', 'draft'].includes(article.status)) throw conflict(`Cannot reject an article that is ${article.status}; retract it instead`);
  article.status = 'rejected';
  article.review = { reviewedBy: userId, reviewedAt: new Date(), notes: reason };
  await article.save();
  await Question.updateMany({ article: article._id, status: { $in: ['in_review', 'draft'] } }, { $set: { status: 'rejected' } });
  return article;
}

/** Withdraws published content. It stays reachable with a retraction notice; its questions leave quizzes. */
async function retractArticle(id, { userId, reason }) {
  const article = await getArticleOr404(id);
  if (article.status !== 'published') throw conflict('Only published articles can be retracted');
  article.status = 'retracted';
  article.retraction = { reason, at: new Date(), by: userId };
  await article.save();
  await Question.updateMany({ article: article._id, status: 'published' }, { $set: { status: 'retired' } });
  return article;
}

/**
 * Edits an article. Draft/in-review edits are free. Editing published content is a
 * correction: it needs a note, bumps the version and stores a revision snapshot.
 */
async function updateArticle(id, changes, { userId, correctionNote }) {
  const article = await getArticleOr404(id);
  if (['rejected', 'retracted'].includes(article.status)) throw conflict(`Cannot edit an article that is ${article.status}`);
  const isPublished = article.status === 'published';
  if (isPublished && !correctionNote) throw badRequest('Editing published content requires a correctionNote explaining the change');
  if (isPublished && changes.factsToVerify) throw badRequest('Flagged facts cannot be changed after publishing');

  const { factsToVerify, ...fields } = changes;
  if (fields.title && fields.title !== article.title && !isPublished) article.slug = await uniqueSlug(fields.title);
  for (const [k, v] of Object.entries(fields)) {
    if (k === 'tags') {
      for (const tagKey of ['gsPaper', 'subjects', 'keywords']) {
        if (v[tagKey] !== undefined) article.set(`tags.${tagKey}`, v[tagKey]);
      }
    } else {
      article.set(k, v);
    }
  }
  if (factsToVerify) article.factsToVerify = factsToVerify.map((text) => ({ text }));

  if (isPublished) {
    article.version += 1;
    article.corrections.push({ note: correctionNote, version: article.version, by: userId });
  }
  await article.save();
  if (isPublished) await recordRevision(article, { reason: correctionNote, userId });
  return article;
}

async function updateQuestion(id, changes, { correctionNote }) {
  const question = await Question.findById(id);
  if (!question) throw notFound('Question not found');
  if (['rejected', 'retired'].includes(question.status)) throw conflict(`Cannot edit a question that is ${question.status}`);
  if (question.status === 'published' && !correctionNote) throw badRequest('Editing a published question requires a correctionNote');
  const options = changes.options ?? question.options;
  const correctIndex = changes.correctIndex ?? question.correctIndex;
  if (correctIndex >= options.length) throw badRequest('correctIndex must point at one of the options');
  Object.assign(question, changes);
  if (question.status === 'published') question.version += 1;
  await question.save();
  return question;
}

async function setQuestionStatus(id, action) {
  const question = await Question.findById(id);
  if (!question) throw notFound('Question not found');
  if (action === 'reject') {
    question.status = question.status === 'published' ? 'retired' : 'rejected';
  } else if (action === 'restore') {
    if (question.status !== 'rejected') throw conflict('Only rejected questions can be restored');
    const article = await Article.findById(question.article).select('status').lean();
    question.status = article?.status === 'published' ? 'published' : 'in_review';
    if (question.status === 'published') question.publishedAt = new Date();
  }
  await question.save();
  return question;
}

/**
 * Merges a duplicate article into another one about the same event. Both must
 * still be in review. Sources, flagged facts (unconfirmed again) and questions
 * move to the target; the duplicate is rejected with a pointer to the target.
 */
async function mergeArticles(sourceId, targetId, { userId }) {
  if (String(sourceId) === String(targetId)) throw badRequest('Choose a different article to merge into');
  const [source, target] = await Promise.all([getArticleOr404(sourceId), getArticleOr404(targetId)]);
  for (const a of [source, target]) {
    if (!['in_review', 'draft'].includes(a.status)) throw conflict(`Only articles in review can be merged ("${a.title}" is ${a.status})`);
  }
  const known = new Set(target.sources.map((src) => src.url));
  const now = new Date();
  for (const src of source.sources) {
    if (!known.has(src.url)) target.sources.push({ ...src.toObject(), addedLater: true, addedAt: now });
  }
  const knownFacts = new Set(target.factsToVerify.map((f) => f.text));
  for (const f of source.factsToVerify) if (!knownFacts.has(f.text)) target.factsToVerify.push({ text: f.text });
  target.factsToVerify.forEach((f) => { f.confirmed = false; }); // New sources: re-check everything.
  target.generation.rawItemIds.push(...(source.generation?.rawItemIds || []));
  if (!target.storyKey && source.storyKey) target.storyKey = source.storyKey;
  await target.save();

  const moved = await Question.updateMany(
    { article: source._id, status: { $in: ['in_review', 'draft'] } },
    { $set: { article: target._id, 'tags.gsPaper': target.tags.gsPaper, 'tags.subjects': target.tags.subjects } },
  );
  await require('../pipeline/rawItem.model').RawItem.updateMany({ article: source._id }, { $set: { article: target._id } });

  source.status = 'rejected';
  source.mergedInto = target._id;
  source.review = { reviewedBy: userId, reviewedAt: now, notes: `Merged into "${target.title}"` };
  await source.save();
  return { target, source, questionsMoved: moved.modifiedCount };
}

module.exports = { mergeArticles, approveArticle, rejectArticle, retractArticle, updateArticle, updateQuestion, setQuestionStatus, getArticleOr404 };
