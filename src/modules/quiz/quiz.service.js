'use strict';
const mongoose = require('mongoose');
const config = require('../../config');
const { Quiz } = require('./quiz.model');
const { Question } = require('./question.model');
const { Attempt } = require('./attempt.model');
const { badRequest, conflict, notFound } = require('../../lib/errors');
const { localDateString } = require('../../lib/dates');

/** Question as shown to a user before answering — never includes the answer. */
function toPlayable(q) {
  return {
    id: q._id,
    stem: q.stem,
    options: q.options,
    difficulty: q.difficulty,
    tags: q.tags,
    version: q.version,
    article: q.article,
  };
}

async function loadQuizWithQuestions(quizId, { includeUnpublished = false } = {}) {
  const quiz = await Quiz.findById(quizId).lean();
  if (!quiz || (!includeUnpublished && quiz.status !== 'published')) throw notFound('Quiz not found');
  const questions = await Question.find({ _id: { $in: quiz.questions }, status: 'published' }).lean();
  // Keep the quiz's ordering; drop questions that were retired after publication.
  const byId = new Map(questions.map((q) => [String(q._id), q]));
  const ordered = quiz.questions.map((id) => byId.get(String(id))).filter(Boolean);
  return { quiz, questions: ordered };
}

async function submitAttempt({ userId, quizId, answers, durationMs }) {
  const { quiz, questions } = await loadQuizWithQuestions(quizId);
  if (!questions.length) throw badRequest('This quiz has no questions');

  const given = new Map();
  for (const a of answers) {
    if (given.has(a.questionId)) throw badRequest('Each question may be answered only once');
    given.set(a.questionId, a);
  }
  const known = new Set(questions.map((q) => String(q._id)));
  for (const id of given.keys()) if (!known.has(id)) throw badRequest(`Question ${id} is not part of this quiz`);

  const graded = questions.map((q) => {
    const a = given.get(String(q._id));
    const selected = a && a.selectedIndex !== null && a.selectedIndex !== undefined ? a.selectedIndex : null;
    if (selected !== null && (selected < 0 || selected >= q.options.length)) {
      throw badRequest(`Invalid option for question ${q._id}`);
    }
    return {
      question: q._id,
      questionVersion: q.version,
      selectedIndex: selected,
      correctIndex: q.correctIndex,
      isCorrect: selected === q.correctIndex,
      timeMs: a?.timeMs,
      subjects: q.tags?.subjects || [],
      gsPaper: q.tags?.gsPaper,
    };
  });

  try {
    const attempt = await Attempt.create({
      user: userId,
      quiz: quiz._id,
      answers: graded,
      score: graded.filter((g) => g.isCorrect).length,
      total: graded.length,
      durationMs,
    });
    return attempt;
  } catch (err) {
    if (err.code === 11000) throw conflict('You have already attempted this quiz');
    throw err;
  }
}

/** Full result with explanations. Notes when a question was corrected after the attempt. */
async function attemptResult(attempt) {
  const questions = await Question.find({ _id: { $in: attempt.answers.map((a) => a.question) } }).lean();
  const byId = new Map(questions.map((q) => [String(q._id), q]));
  return {
    id: attempt._id,
    quiz: attempt.quiz,
    score: attempt.score,
    total: attempt.total,
    submittedAt: attempt.submittedAt,
    answers: attempt.answers.map((a) => {
      const q = byId.get(String(a.question));
      return {
        questionId: a.question,
        stem: q?.stem,
        options: q?.options,
        selectedIndex: a.selectedIndex,
        correctIndex: a.correctIndex,
        isCorrect: a.isCorrect,
        explanation: q?.explanation,
        article: q?.article,
        updatedSinceAttempt: q ? q.version !== a.questionVersion : false,
        currentCorrectIndex: q && q.version !== a.questionVersion ? q.correctIndex : undefined,
        retired: q ? q.status === 'retired' : true,
      };
    }),
  };
}

async function progressFor(userId) {
  const uid = new mongoose.Types.ObjectId(String(userId));
  const [bySubject, overall] = await Promise.all([
    Attempt.aggregate([
      { $match: { user: uid } },
      { $unwind: '$answers' },
      { $unwind: '$answers.subjects' },
      {
        $group: {
          _id: '$answers.subjects',
          attempted: { $sum: { $cond: [{ $ne: ['$answers.selectedIndex', null] }, 1, 0] } },
          correct: { $sum: { $cond: ['$answers.isCorrect', 1, 0] } },
          seen: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Attempt.aggregate([
      { $match: { user: uid } },
      { $group: { _id: null, quizzes: { $sum: 1 }, score: { $sum: '$score' }, total: { $sum: '$total' } } },
    ]),
  ]);
  const o = overall[0] || { quizzes: 0, score: 0, total: 0 };
  return {
    quizzesTaken: o.quizzes,
    questionsSeen: o.total,
    correct: o.score,
    accuracy: o.total ? Math.round((o.score / o.total) * 1000) / 10 : null,
    bySubject: bySubject.map((s) => ({
      subject: s._id,
      seen: s.seen,
      attempted: s.attempted,
      correct: s.correct,
      accuracy: s.seen ? Math.round((s.correct / s.seen) * 1000) / 10 : null,
    })),
  };
}

/**
 * Builds and publishes the daily quiz from recently published questions that have
 * not been used in a daily quiz yet, spreading picks across subjects. Safe to re-run:
 * a unique index allows only one daily quiz per date.
 */
async function assembleDailyQuiz({ date = localDateString(), size = config.pipeline.dailyQuizSize, lookbackDays = 3 } = {}) {
  const existing = await Quiz.findOne({ type: 'daily', date }).lean();
  if (existing) return { created: false, quiz: existing, reason: 'already_exists' };

  const since = new Date(Date.now() - lookbackDays * 24 * 3600 * 1000);
  const recentQuizzes = await Quiz.find({ type: 'daily', createdAt: { $gte: new Date(Date.now() - 60 * 24 * 3600 * 1000) } })
    .select('questions')
    .lean();
  const used = recentQuizzes.flatMap((q) => q.questions);

  const candidates = await Question.find({ status: 'published', publishedAt: { $gte: since }, _id: { $nin: used } })
    .sort({ publishedAt: -1 })
    .limit(size * 5)
    .lean();
  if (!candidates.length) return { created: false, reason: 'no_questions' };

  // Round-robin by primary subject so one busy topic doesn't dominate the quiz.
  const buckets = new Map();
  for (const q of candidates) {
    const key = q.tags?.subjects?.[0] || 'other';
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(q);
  }
  const picked = [];
  while (picked.length < size && buckets.size) {
    for (const [key, list] of buckets) {
      if (picked.length >= size) break;
      picked.push(list.shift());
      if (!list.length) buckets.delete(key);
    }
  }

  try {
    const quiz = await Quiz.create({
      type: 'daily',
      date,
      title: `Daily Current Affairs Quiz – ${date}`,
      questions: picked.map((q) => q._id),
      status: 'published',
      publishedAt: new Date(),
    });
    return { created: true, quiz: quiz.toObject() };
  } catch (err) {
    if (err.code === 11000) {
      return { created: false, quiz: await Quiz.findOne({ type: 'daily', date }).lean(), reason: 'already_exists' };
    }
    throw err;
  }
}

module.exports = { toPlayable, loadQuizWithQuestions, submitAttempt, attemptResult, progressFor, assembleDailyQuiz };
