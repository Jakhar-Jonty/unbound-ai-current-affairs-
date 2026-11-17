'use strict';
const express = require('express');
const mongoose = require('mongoose');
const { validate, objectId, z } = require('../../lib/validate');
const { notFound, badRequest } = require('../../lib/errors');
const { requireAuth, optionalAuth } = require('../users/auth.middleware');
const { rateLimit } = require('express-rate-limit');
const { Question } = require('../quiz/question.model');
const { Attempt } = require('../quiz/attempt.model');
const { toPlayable } = require('../quiz/quiz.service');
const { PracticeAnswer } = require('./practice.model');
const { SUBJECT_KEYS } = require('../taxonomy/taxonomy');
const config = require('../../config');
const { isPremium, premiumRequired } = require('../billing/entitlements');
const { dayStart } = require('../../lib/dates');

/** Free practice answers left today (IST), or null for premium users. Guests: see guestLimit. */
async function remainingToday(user) {
  if (!user) return null;
  if (isPremium(user)) return null;
  const used = await PracticeAnswer.countDocuments({ user: user._id, answeredAt: { $gte: dayStart() } });
  return Math.max(0, config.premium.freePracticePerDay - used);
}

const router = express.Router();
// Questions and answer checks work without an account; stats need one.
router.use('/practice', optionalAuth);

/**
 * Guests get the free daily allowance per IP (nothing is stored for them). While
 * premium is switched off they get a generous cap that only stops abuse.
 */
const guestLimit = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  limit: () => (config.premium.enabled ? config.premium.freePracticePerDay : 300),
  skip: (req) => !!req.user,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (_req, _res, next) => next(premiumRequired('practice')),
});

// Number of practice questions available per subject.
router.get('/practice/subjects', async (_req, res) => {
  const rows = await Question.aggregate([
    { $match: { status: 'published' } },
    { $unwind: '$tags.subjects' },
    { $group: { _id: '$tags.subjects', questions: { $sum: 1 } } },
  ]);
  res.json({ subjects: Object.fromEntries(rows.map((r) => [r._id, r.questions])) });
});

/**
 * A random practice set for a subject. Questions the user has already answered
 * correctly (in quizzes or practice) come last, so practice favours new and missed ones.
 */
router.get('/practice/questions', validate(z.object({
  subject: z.enum(SUBJECT_KEYS),
  count: z.coerce.number().int().min(1).max(20).default(10),
}), 'query'), async (req, res) => {
  const { subject, count } = req.valid.query;
  const uid = req.user?._id;
  const remaining = await remainingToday(req.user);
  if (remaining === 0) throw premiumRequired('practice');
  const [quizCorrect, practiceCorrect] = uid ? await Promise.all([
    Attempt.aggregate([{ $match: { user: uid } }, { $unwind: '$answers' }, { $match: { 'answers.isCorrect': true } }, { $group: { _id: '$answers.question' } }]),
    PracticeAnswer.distinct('question', { user: uid, isCorrect: true }),
  ]) : [[], []];
  const mastered = [...quizCorrect.map((r) => r._id), ...practiceCorrect];
  const base = { status: 'published', 'tags.subjects': subject };
  const fresh = await Question.aggregate([{ $match: { ...base, _id: { $nin: mastered } } }, { $sample: { size: count } }]);
  let picked = fresh;
  if (fresh.length < count) {
    const more = await Question.aggregate([{ $match: { ...base, _id: { $in: mastered } } }, { $sample: { size: count - fresh.length } }]);
    picked = [...fresh, ...more];
  }
  res.json({ subject, questions: picked.map(toPlayable), newQuestions: fresh.length, remainingToday: remaining });
});

// Checks one answer and returns the explanation straight away.
router.post('/practice/answers', guestLimit, validate(z.object({ questionId: objectId, selectedIndex: z.number().int().min(0) })), async (req, res) => {
  const { questionId, selectedIndex } = req.valid.body;
  const remaining = await remainingToday(req.user);
  if (remaining === 0) throw premiumRequired('practice');
  const q = await Question.findOne({ _id: questionId, status: 'published' }).lean();
  if (!q) throw notFound('Question not found');
  if (selectedIndex >= q.options.length) throw badRequest('Invalid option');
  const isCorrect = selectedIndex === q.correctIndex;
  if (!req.user) {
    return res.status(201).json({ isCorrect, correctIndex: q.correctIndex, explanation: q.explanation, article: q.article, remainingToday: null, saved: false });
  }
  await PracticeAnswer.create({
    user: req.user._id, question: q._id, questionVersion: q.version, selectedIndex, isCorrect,
    subjects: q.tags?.subjects || [], gsPaper: q.tags?.gsPaper,
  });
  res.status(201).json({ isCorrect, correctIndex: q.correctIndex, explanation: q.explanation, article: q.article, remainingToday: remaining === null ? null : remaining - 1 });
});

router.get('/practice/stats', requireAuth, async (req, res) => {
  const rows = await PracticeAnswer.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(String(req.user._id)) } },
    { $group: { _id: null, answered: { $sum: 1 }, correct: { $sum: { $cond: ['$isCorrect', 1, 0] } } } },
  ]);
  res.json({ answered: rows[0]?.answered || 0, correct: rows[0]?.correct || 0 });
});

module.exports = router;
