'use strict';
const { Article } = require('./article.model');
const { ArticleRevision } = require('./articleRevision.model');
const { slugify } = require('../../lib/text');

const EDITABLE_FIELDS = ['title', 'summary', 'body', 'keyPoints', 'upscRelevance', 'tags', 'sources', 'eventDate'];

async function uniqueSlug(title) {
  const base = slugify(title) || 'article';
  let slug = base;
  for (let i = 2; await Article.exists({ slug }); i += 1) slug = `${base}-${i}`;
  return slug;
}

function snapshotOf(article) {
  const o = article.toObject({ depopulate: true });
  const pick = {};
  for (const f of [...EDITABLE_FIELDS, 'slug', 'status', 'version', 'publishedAt', 'factsToVerify']) pick[f] = o[f];
  return pick;
}

async function recordRevision(article, { reason, userId } = {}) {
  await ArticleRevision.updateOne(
    { article: article._id, version: article.version },
    { $setOnInsert: { snapshot: snapshotOf(article), reason, changedBy: userId } },
    { upsert: true },
  );
}

/** Shape returned by public list endpoints. */
function toListItem(a) {
  return {
    id: a._id,
    slug: a.slug,
    title: a.title,
    summary: a.summary,
    tags: a.tags,
    status: a.status,
    version: a.version,
    eventDate: a.eventDate,
    publishedAt: a.publishedAt,
  };
}

/** Shape returned by the public detail endpoint. */
function toPublicDetail(a) {
  return {
    ...toListItem(a),
    body: a.body,
    keyPoints: a.keyPoints,
    upscRelevance: a.upscRelevance,
    sources: (a.sources || []).map((s) => ({ url: s.url, publisher: s.publisher, title: s.title, publishedAt: s.publishedAt })),
    corrections: (a.corrections || []).map((c) => ({ note: c.note, version: c.version, at: c.at })),
    retraction: a.status === 'retracted' ? { reason: a.retraction?.reason, at: a.retraction?.at } : undefined,
    updatedAt: a.updatedAt,
  };
}

module.exports = { uniqueSlug, recordRevision, snapshotOf, toListItem, toPublicDetail, EDITABLE_FIELDS };
