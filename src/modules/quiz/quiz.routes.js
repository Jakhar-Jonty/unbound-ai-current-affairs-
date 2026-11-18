'use strict';
const express = require('express');
const { validate, pagination, objectId, z } = require('../../lib/validate');
const { notFound, unauthorized } = require('../../lib/errors');
const mock = require('./mock.service');
const { localDateString } = require('../../lib/dates');
const { requireAuth, optionalAuth } = require('../users/auth.middleware');
const { Quiz } = require('./quiz.model');
const { Attempt } = require('./attempt.model');
const svc = require('./quiz.service');
const { langOf } = require('../content/i18n');
const { isArchive, isPremium, premiumRequired } = require('../billing/entitlements');

const router = express.Router();

function quizSummary(q) {
  return {
    id: q._id, type: q.type, date: q.date, week: q.week, title: q.title, questionCount: q.questions.length,
    durationSeconds: q.durationSeconds, marking: q.marking, publishedAt: q.publishedAt, premium: isArchive(q.publishedAt),
  };
}

/** Adds mock marks and the live rank to a result. */
async function withMock(result, attempt, userId) {
  // Every attempt has a (possibly empty) mock object; only mock tests have marks.
  if (typeof attempt.mock?.maxMarks !== 'number') return result;
  const m = attempt.mock.toObject ? attempt.mock.toObject() : attempt.mock;
  return { ...result, mock: { ...m, ...(await mock.mockRanking(attempt.quiz, userId)) } };
}

router.get('/quizzes', validate(pagination.extend({ type: z.enum(['daily', 'topic', 'custom', 'mock']).optional() }), 'query'), async (req, res) => {
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
    const a = await Attempt.findOne({ user: req.user._id, quiz: quiz._id }).select('_id score total submittedAt mock').lean();
    if (a) myAttempt = { id: a._id, score: a.score, total: a.total, submittedAt: a.submittedAt, marks: a.mock?.marks, maxMarks: a.mock?.maxMarks };
  }
  // Old quizzes are premium, but your own past attempts stay reachable.
  if (isArchive(quiz.publishedAt) && !isPremium(req.user) && !myAttempt) throw premiumRequired('archive');
  if (quiz.type === 'mock' && !myAttempt) {
    // Mock questions are only sent once the timer has started (see POST /quizzes/:id/start).
    const start = req.user ? await mock.getStart(req.user._id, quiz._id) : null;
    const timer = start ? { startedAt: start.startedAt, endsAt: new Date(start.startedAt.getTime() + quiz.durationSeconds * 1000) } : null;
    return res.json({
      quiz: { ...quizSummary(quiz), questionCount: questions.length },
      questions: timer ? questions.map((q) => svc.toPlayable(q, langOf(req))) : [],
      myAttempt, timer, requiresStart: !timer,
    });
  }
  res.json({ quiz: { ...quizSummary(quiz), questionCount: questions.length }, questions: questions.map((q) => svc.toPlayable(q, langOf(req))), myAttempt });
}

router.get('/quizzes/today', optionalAuth, async (req, res) => {
  const quiz = await Quiz.findOne({ type: 'daily', date: localDateString(), status: 'published' }).select('_id').lean();
  if (!quiz) throw notFound("Today's quiz is not available yet");
  await sendQuiz(req, res, quiz._id);
});

// The latest weekly mock test.
router.get('/quizzes/mock/current', optionalAuth, async (req, res) => {
  const quiz = await Quiz.findOne({ type: 'mock', status: 'published' }).sort({ publishedAt: -1 }).select('_id').lean();
  if (!quiz) throw notFound('No mock test yet. The first one is published on Sunday morning.');
  await sendQuiz(req, res, quiz._id);
});

router.post('/quizzes/:id/start', requireAuth, async (req, res) => {
  objectId.parse(req.params.id);
  const quiz = await mock.loadMock(req.params.id);
  if (isArchive(quiz.publishedAt) && !isPremium(req.user)) throw premiumRequired('archive');
  const timer = await mock.startMock(req.user, quiz);
  const { questions } = await svc.loadQuizWithQuestions(quiz._id);
  res.status(201).json({ timer, questions: questions.map((q) => svc.toPlayable(q, langOf(req))) });
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
  const quiz = await Quiz.findById(req.params.id).select('publishedAt type').lean();
  if (quiz?.type === 'mock') throw unauthorized('Sign in to take the mock test. Your marks and rank are saved to your account.');
  if (quiz && isArchive(quiz.publishedAt)) throw premiumRequired('archive');
  res.json({ result: await svc.checkAnswers({ quizId: req.params.id, answers: req.valid.body.answers, lang: langOf(req) }) });
});

router.post('/quizzes/:id/attempts', requireAuth, validate(attemptSchema), async (req, res) => {
  objectId.parse(req.params.id);
  const quiz = await Quiz.findById(req.params.id).lean();
  if (quiz && isArchive(quiz.publishedAt) && !isPremium(req.user)) throw premiumRequired('archive');
  const attempt = quiz?.type === 'mock'
    ? await mock.submitMock({ user: req.user, quiz, answers: req.valid.body.answers })
    : await svc.submitAttempt({ userId: req.user._id, quizId: req.params.id, ...req.valid.body });
  res.status(201).json({ result: await withMock(await svc.attemptResult(attempt, langOf(req)), attempt, req.user._id) });
});

router.get('/attempts/:id', requireAuth, async (req, res) => {
  objectId.parse(req.params.id);
  const attempt = await Attempt.findOne({ _id: req.params.id, user: req.user._id }).lean();
  if (!attempt) throw notFound('Attempt not found');
  res.json({ result: await withMock(await svc.attemptResult(attempt, langOf(req)), attempt, req.user._id) });
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
