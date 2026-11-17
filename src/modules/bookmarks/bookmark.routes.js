'use strict';
const express = require('express');
const { validate, pagination, objectId, z } = require('../../lib/validate');
const { notFound } = require('../../lib/errors');
const { requireAuth } = require('../users/auth.middleware');
const { Bookmark } = require('./bookmark.model');
const { Article } = require('../content/article.model');
const { Question } = require('../quiz/question.model');
const { toListItem } = require('../content/content.service');

const router = express.Router();
router.use('/me/bookmarks', requireAuth);

const MODELS = { article: ['Article', Article], question: ['Question', Question] };
const VISIBLE = { article: ['published', 'retracted'], question: ['published', 'retired'] };

function present(b) {
  const base = { id: b._id, itemType: b.itemType, note: b.note, createdAt: b.createdAt };
  const it = b.item;
  if (!it || typeof it !== 'object' || !it._id) return { ...base, item: null, unavailable: true };
  if (b.itemType === 'article') return { ...base, item: toListItem(it) };
  return {
    ...base,
    item: { id: it._id, stem: it.stem, options: it.options, correctIndex: it.correctIndex, explanation: it.explanation, status: it.status, article: it.article },
  };
}

router.get('/me/bookmarks', validate(pagination.extend({ type: z.enum(['article', 'question']).optional() }), 'query'), async (req, res) => {
  const { page, limit, type } = req.valid.query;
  const filter = { user: req.user._id, ...(type ? { itemType: type } : {}) };
  const [items, total] = await Promise.all([
    Bookmark.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('item').lean(),
    Bookmark.countDocuments(filter),
  ]);
  res.json({ items: items.map(present), page, limit, total });
});

// Which of the given items the user has bookmarked: { bookmarks: { [itemId]: bookmarkId } }.
const statusSchema = z.object({
  itemType: z.enum(['article', 'question']),
  ids: z.string().transform((s) => s.split(',').filter(Boolean)).pipe(z.array(objectId).min(1).max(100)),
});

router.get('/me/bookmarks/status', validate(statusSchema, 'query'), async (req, res) => {
  const { itemType, ids } = req.valid.query;
  const found = await Bookmark.find({ user: req.user._id, itemType, item: { $in: ids } }).select('item').lean();
  res.json({ bookmarks: Object.fromEntries(found.map((b) => [String(b.item), String(b._id)])) });
});

const createSchema = z.object({
  itemType: z.enum(['article', 'question']),
  itemId: objectId,
  note: z.string().trim().max(500).optional(),
});

router.post('/me/bookmarks', validate(createSchema), async (req, res) => {
  const { itemType, itemId, note } = req.valid.body;
  const [modelName, Model] = MODELS[itemType];
  const exists = await Model.exists({ _id: itemId, status: { $in: VISIBLE[itemType] } });
  if (!exists) throw notFound(`${modelName} not found`);
  const bookmark = await Bookmark.findOneAndUpdate(
    { user: req.user._id, itemType, item: itemId },
    { $setOnInsert: { itemModel: modelName }, ...(note !== undefined ? { $set: { note } } : {}) },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  );
  res.status(201).json({ bookmark: { id: bookmark._id, itemType, itemId, note: bookmark.note } });
});

router.delete('/me/bookmarks/:id', async (req, res) => {
  objectId.parse(req.params.id);
  const r = await Bookmark.deleteOne({ _id: req.params.id, user: req.user._id });
  if (!r.deletedCount) throw notFound('Bookmark not found');
  res.status(204).end();
});

module.exports = router;
