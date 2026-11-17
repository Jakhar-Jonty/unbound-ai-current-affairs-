'use strict';
const express = require('express');
const mongoose = require('mongoose');
const { validate, pagination, z } = require('../../lib/validate');
const { notFound } = require('../../lib/errors');
const { Article } = require('./article.model');
const { toListItem, toPublicDetail } = require('./content.service');
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
  gsPaper: z.enum(GS_PAPER_KEYS).optional(),
  q: z.string().trim().min(2).max(100).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

router.get('/articles', publicCache(60), validate(listQuery, 'query'), async (req, res) => {
  const { page, limit, subject, gsPaper, q, from, to } = req.valid.query;
  const filter = { status: 'published' };
  if (subject) filter['tags.subjects'] = subject;
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
  res.json({ items: items.map(toListItem), page, limit, total });
});

router.get('/articles/:idOrSlug', publicCache(60), async (req, res) => {
  const { idOrSlug } = req.params;
  const byId = mongoose.isValidObjectId(idOrSlug) && /^[a-f0-9]{24}$/i.test(idOrSlug);
  const article = await Article.findOne({
    ...(byId ? { _id: idOrSlug } : { slug: idOrSlug }),
    status: { $in: ['published', 'retracted'] },
  }).lean();
  if (!article) throw notFound('Article not found');
  res.json({ article: toPublicDetail(article) });
});

module.exports = router;
