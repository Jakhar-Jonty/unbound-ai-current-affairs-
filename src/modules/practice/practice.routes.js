'use strict';
const express = require('express');
const mongoose = require('mongoose');
const { validate, objectId, z } = require('../../lib/validate');
const { notFound, badRequest } = require('../../lib/errors');
const { requireAuth } = require('../users/auth.middleware');
const { Question } = require('../quiz/question.model');
const { Attempt } = require('../quiz/attempt.model');
const { toPlayable } = require('../quiz/quiz.service');
const { PracticeAnswer } = require('./practice.model');
const { SUBJECT_KEYS } = require('../taxonomy/taxonomy');

const router = express.Router();
router.use('/practice', requireAuth);

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
  const uid = req.user._id;
  const [quizCorrect, practiceCorrect] = await Promise.all([
    Attempt.aggregate([{ $match: { user: uid } }, { $unwind: '$answers' }, { $match: { 'answers.isCorrect': true } }, { $group: { _id: '$answers.question' } }]),
    PracticeAnswer.distinct('question', { user: uid, isCorrect: true }),
  ]);
  const mastered = [...quizCorrect.map((r) => r._id), ...practiceCorrect];
  const base = { status: 'published', 'tags.subjects': subject };
  const fresh = await Question.aggregate([{ $match: { ...base, _id: { $nin: mastered } } }, { $sample: { size: count } }]);
  let picked = fresh;
  if (fresh.length < count) {
    const more = await Question.aggregate([{ $match: { ...base, _id: { $in: mastered } } }, { $sample: { size: count - fresh.length } }]);
    picked = [...fresh, ...more];
  }
  res.json({ subject, questions: picked.map(toPlayable), newQuestions: fresh.length });
});

// Checks one answer and returns the explanation straight away.
router.post('/practice/answers', validate(z.object({ questionId: objectId, selectedIndex: z.number().int().min(0) })), async (req, res) => {
  const { questionId, selectedIndex } = req.valid.body;
  const q = await Question.findOne({ _id: questionId, status: 'published' }).lean();
  if (!q) throw notFound('Question not found');
  if (selectedIndex >= q.options.length) throw badRequest('Invalid option');
  const isCorrect = selectedIndex === q.correctIndex;
  await PracticeAnswer.create({
    user: req.user._id, question: q._id, questionVersion: q.version, selectedIndex, isCorrect,
    subjects: q.tags?.subjects || [], gsPaper: q.tags?.gsPaper,
  });
  res.status(201).json({ isCorrect, correctIndex: q.correctIndex, explanation: q.explanation, article: q.article });
});

router.get('/practice/stats', async (req, res) => {
  const rows = await PracticeAnswer.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(String(req.user._id)) } },
    { $group: { _id: null, answered: { $sum: 1 }, correct: { $sum: { $cond: ['$isCorrect', 1, 0] } } } },
  ]);
  res.json({ answered: rows[0]?.answered || 0, correct: rows[0]?.correct || 0 });
});

module.exports = router;
