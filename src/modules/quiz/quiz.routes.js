'use strict';
const express = require('express');
const { validate, pagination, objectId, z } = require('../../lib/validate');
const { notFound } = require('../../lib/errors');
const { localDateString } = require('../../lib/dates');
const { requireAuth, optionalAuth } = require('../users/auth.middleware');
const { Quiz } = require('./quiz.model');
const { Attempt } = require('./attempt.model');
const svc = require('./quiz.service');
const { isArchive, isPremium, premiumRequired } = require('../billing/entitlements');

const router = express.Router();

function quizSummary(q) {
  return { id: q._id, type: q.type, date: q.date, title: q.title, questionCount: q.questions.length, publishedAt: q.publishedAt, premium: isArchive(q.publishedAt) };
}

router.get('/quizzes', validate(pagination.extend({ type: z.enum(['daily', 'topic', 'custom']).optional() }), 'query'), async (req, res) => {
  const { page, limit, type } = req.valid.query;
  const filter = { status: 'published', ...(type ? { type } : {}) };
  const [items, total] = await Promise.all([
    Quiz.find(filter).sort({ publishedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Quiz.countDocuments(filter),
  ]);
  res.json({ items: items.map(quizSummary), page, limit, total });
});

async function sendQuiz(req, res, quizId) {
  const { quiz, questions } = await svc.loadQuizWithQuestions(quizId);
  let myAttempt = null;
  if (req.user) {
    const a = await Attempt.findOne({ user: req.user._id, quiz: quiz._id }).select('_id score total submittedAt').lean();
    if (a) myAttempt = { id: a._id, score: a.score, total: a.total, submittedAt: a.submittedAt };
  }
  // Old quizzes are premium, but your own past attempts stay reachable.
  if (isArchive(quiz.publishedAt) && !isPremium(req.user) && !myAttempt) throw premiumRequired('archive');
  res.json({ quiz: { ...quizSummary(quiz), questionCount: questions.length }, questions: questions.map(svc.toPlayable), myAttempt });
}

router.get('/quizzes/today', optionalAuth, async (req, res) => {
  const quiz = await Quiz.findOne({ type: 'daily', date: localDateString(), status: 'published' }).select('_id').lean();
  if (!quiz) throw notFound("Today's quiz is not available yet");
  await sendQuiz(req, res, quiz._id);
});

router.get('/quizzes/:id', optionalAuth, async (req, res) => {
  objectId.parse(req.params.id);
  await sendQuiz(req, res, req.params.id);
});

const attemptSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: objectId,
        selectedIndex: z.number().int().min(0).nullable(),
        timeMs: z.number().int().min(0).max(3_600_000).optional(),
      }),
    )
    .max(200),
  durationMs: z.number().int().min(0).max(24 * 3_600_000).optional(),
});

// Guests can try the quiz: graded but not saved. Rate-limited per IP.
const guestLimiter = require('express-rate-limit').rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: require('../../config').isTest ? 1000 : 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

router.post('/quizzes/:id/check', guestLimiter, validate(attemptSchema), async (req, res) => {
  objectId.parse(req.params.id);
  const quiz = await Quiz.findById(req.params.id).select('publishedAt').lean();
  if (quiz && isArchive(quiz.publishedAt)) throw premiumRequired('archive');
  res.json({ result: await svc.checkAnswers({ quizId: req.params.id, answers: req.valid.body.answers }) });
});

router.post('/quizzes/:id/attempts', requireAuth, validate(attemptSchema), async (req, res) => {
  objectId.parse(req.params.id);
  const quiz = await Quiz.findById(req.params.id).select('publishedAt').lean();
  if (quiz && isArchive(quiz.publishedAt) && !isPremium(req.user)) throw premiumRequired('archive');
  const attempt = await svc.submitAttempt({ userId: req.user._id, quizId: req.params.id, ...req.valid.body });
  res.status(201).json({ result: await svc.attemptResult(attempt) });
});

router.get('/attempts/:id', requireAuth, async (req, res) => {
  objectId.parse(req.params.id);
  const attempt = await Attempt.findOne({ _id: req.params.id, user: req.user._id }).lean();
  if (!attempt) throw notFound('Attempt not found');
  res.json({ result: await svc.attemptResult(attempt) });
});

router.get('/me/attempts', requireAuth, validate(pagination, 'query'), async (req, res) => {
  const { page, limit } = req.valid.query;
  const filter = { user: req.user._id };
  const [items, total] = await Promise.all([
    Attempt.find(filter).sort({ submittedAt: -1 }).skip((page - 1) * limit).limit(limit)
      .populate('quiz', 'title date type').select('quiz score total submittedAt').lean(),
    Attempt.countDocuments(filter),
  ]);
  res.json({
    items: items.map((a) => ({ id: a._id, quiz: a.quiz, score: a.score, total: a.total, submittedAt: a.submittedAt })),
    page, limit, total,
  });
});

router.get('/me/progress', requireAuth, async (req, res) => {
  res.json({ progress: await svc.progressFor(req.user._id) });
});

module.exports = router;
