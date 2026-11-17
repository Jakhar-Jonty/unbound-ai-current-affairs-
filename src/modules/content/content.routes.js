'use strict';
const express = require('express');
const mongoose = require('mongoose');
const { validate, pagination, z } = require('../../lib/validate');
const { notFound } = require('../../lib/errors');
const { Article } = require('./article.model');
const { toListItem, toPublicDetail } = require('./content.service');
const { optionalAuth } = require('../users/auth.middleware');
const { isArchive, isPremium, premiumRequired } = require('../billing/entitlements');
const { vectorize, cosine } = require('../pipeline/similarity');
const { GS_PAPERS, SUBJECTS, GS_PAPER_KEYS, SUBJECT_KEYS } = require('../taxonomy/taxonomy');

const router = express.Router();

// Published content is identical for every user, so let clients and CDNs cache it briefly.
function publicCache(seconds) {
  return (_req, res, next) => {
    res.set('Cache-Control', `public, max-age=${seconds}, stale-while-revalidate=${seconds * 5}`);
    next();
  };
}

router.get('/taxonomy', publicCache(3600), (_req, res) => {
  res.json({ gsPapers: GS_PAPERS, subjects: SUBJECTS });
});

const listQuery = pagination.extend({
  subject: z.enum(SUBJECT_KEYS).optional(),
  // Several subjects, comma-separated (the user's "my subjects" feed).
  subjects: z.string().transform((s) => s.split(',').filter(Boolean)).pipe(z.array(z.enum(SUBJECT_KEYS)).max(16)).optional(),
  gsPaper: z.enum(GS_PAPER_KEYS).optional(),
  q: z.string().trim().min(2).max(100).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

router.get('/articles', publicCache(60), validate(listQuery, 'query'), async (req, res) => {
  const { page, limit, subject, subjects, gsPaper, q, from, to } = req.valid.query;
  const filter = { status: 'published' };
  if (subject) filter['tags.subjects'] = subject;
  else if (subjects?.length) filter['tags.subjects'] = { $in: subjects };
  if (gsPaper) filter['tags.gsPaper'] = gsPaper;
  if (q) filter.$text = { $search: q };
  if (from || to) {
    filter.publishedAt = {};
    if (from) filter.publishedAt.$gte = from;
    if (to) filter.publishedAt.$lte = to;
  }
  const [items, total] = await Promise.all([
    Article.find(filter).sort({ publishedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Article.countDocuments(filter),
  ]);
  // `premium` marks archive items (same for every user, so the list stays cacheable).
  res.json({ items: items.map((a) => ({ ...toListItem(a), premium: isArchive(a.publishedAt) })), page, limit, total });
});

/**
 * Up to 4 other published articles on the same subjects from the last 60 days,
 * most similar first (same scoring as story grouping), then newest.
 */
router.get('/articles/:id/related', publicCache(300), async (req, res) => {
  if (!/^[a-f0-9]{24}$/i.test(req.params.id)) throw notFound('Article not found');
  const article = await Article.findOne({ _id: req.params.id, status: { $in: ['published', 'retracted'] } }).lean();
  if (!article) throw notFound('Article not found');
  const since = new Date((article.publishedAt || new Date()).getTime() - 60 * 86400000);
  const candidates = await Article.find({
    _id: { $ne: article._id },
    status: 'published',
    'tags.subjects': { $in: article.tags?.subjects || [] },
    publishedAt: { $gte: since },
  }).sort({ publishedAt: -1 }).limit(60).lean();
  const asItem = (a) => ({ title: a.title, description: `${a.summary} ${(a.tags?.keywords || []).join(' ')}` });
  const vecs = vectorize([asItem(article), ...candidates.map(asItem)]);
  const ranked = candidates
    .map((a, i) => ({ a, score: cosine(vecs[0], vecs[i + 1]) }))
    .sort((x, y) => y.score - x.score || y.a.publishedAt - x.a.publishedAt)
    .slice(0, 4);
  res.json({ items: ranked.map(({ a }) => ({ ...toListItem(a), premium: isArchive(a.publishedAt) })) });
});

router.get('/articles/:idOrSlug', optionalAuth, async (req, res) => {
  const { idOrSlug } = req.params;
  const byId = mongoose.isValidObjectId(idOrSlug) && /^[a-f0-9]{24}$/i.test(idOrSlug);
  const article = await Article.findOne({
    ...(byId ? { _id: idOrSlug } : { slug: idOrSlug }),
    status: { $in: ['published', 'retracted'] },
  }).lean();
  if (!article) throw notFound('Article not found');
  if (isArchive(article.publishedAt)) {
    // Archive: the answer depends on who's asking, so it must not be cached publicly.
    res.set('Cache-Control', 'private, no-store');
    if (!isPremium(req.user)) {
      const err = premiumRequired('archive');
      err.details.teaser = { id: article._id, title: article.title, summary: article.summary, publishedAt: article.publishedAt };
      throw err;
    }
  } else {
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  }
  res.json({ article: toPublicDetail(article) });
});

module.exports = router;
