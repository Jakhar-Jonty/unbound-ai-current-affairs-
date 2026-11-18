'use strict';
const config = require('../../config');
const { Quiz } = require('./quiz.model');
const { Question } = require('./question.model');
const { Attempt, QuizStart } = require('./attempt.model');
const { spreadBySubject, gradeAnswers } = require('./quiz.service');
const { weekRange } = require('../../lib/dates');
const { displayName } = require('../leaderboard/leaderboard.service');
const { badRequest, conflict, notFound } = require('../../lib/errors');

/**
 * Weekly mock test, UPSC Prelims style: questions from the week's news, 72 seconds a
 * question (100 questions in 2 hours), +2 for a correct answer and −2/3 for a wrong
 * one, nothing for a skipped one. One attempt per user; questions are only sent
 * after the user starts, and the time limit is checked on the server.
 */
const MARKING = { correct: 2, wrong: -2 / 3 };
const SECONDS_PER_QUESTION = 72;
const GRACE_MS = 2 * 60 * 1000; // network slack for the final submit
const MIN_QUESTIONS = 10;

const round2 = (n) => Math.round(n * 100) / 100;

function scoreMock(graded, marking = MARKING) {
  const correct = graded.filter((g) => g.isCorrect).length;
  const unanswered = graded.filter((g) => g.selectedIndex === null).length;
  const wrong = graded.length - correct - unanswered;
  return {
    marks: round2(correct * marking.correct + wrong * marking.wrong),
    maxMarks: round2(graded.length * marking.correct),
    correct, wrong, unanswered,
  };
}

/** Builds and publishes the mock for the week containing `date` (keyed by its Monday). Safe to re-run. */
async function assembleWeeklyMock({ date = new Date(), size = config.pipeline.mockSize } = {}) {
  const { startDate: week } = weekRange(date);
  const existing = await Quiz.findOne({ type: 'mock', week }).lean();
  if (existing) return { created: false, quiz: existing, reason: 'already_exists' };

  const since = new Date(date.getTime() - 7 * 86400000);
  const candidates = await Question.find({ status: 'published', publishedAt: { $gte: since, $lte: date } })
    .sort({ publishedAt: -1 }).limit(size * 4).lean();
  if (candidates.length < MIN_QUESTIONS) return { created: false, reason: 'not_enough_questions', available: candidates.length };

  const picked = spreadBySubject(candidates, size);
  try {
    const quiz = await Quiz.create({
      type: 'mock',
      week,
      title: `Weekly mock test – week of ${week}`,
      questions: picked.map((q) => q._id),
      durationSeconds: picked.length * SECONDS_PER_QUESTION,
      marking: MARKING,
      status: 'published',
      publishedAt: new Date(),
    });
    return { created: true, quiz: quiz.toObject() };
  } catch (err) {
    if (err.code === 11000) return { created: false, quiz: await Quiz.findOne({ type: 'mock', week }).lean(), reason: 'already_exists' };
    throw err;
  }
}

/** Starts (or resumes) the user's timed attempt. Returns { startedAt, endsAt }. */
async function startMock(user, quiz) {
  if (quiz.type !== 'mock') throw badRequest('Only mock tests are started this way');
  if (await Attempt.exists({ user: user._id, quiz: quiz._id })) throw conflict('You have already taken this mock test');
  const start = await QuizStart.findOneAndUpdate(
    { user: user._id, quiz: quiz._id },
    { $setOnInsert: { startedAt: new Date() } },
    { upsert: true, returnDocument: 'after' },
  );
  return { startedAt: start.startedAt, endsAt: new Date(start.startedAt.getTime() + quiz.durationSeconds * 1000) };
}

async function getStart(userId, quizId) {
  const s = await QuizStart.findOne({ user: userId, quiz: quizId }).lean();
  return s || null;
}

/** Grades and saves a mock attempt. Submissions after the time limit (plus grace) count but aren't ranked. */
async function submitMock({ user, quiz, answers }) {
  const start = await getStart(user._id, quiz._id);
  if (!start) throw badRequest('Start the mock test before submitting it');
  const { graded } = await gradeAnswers(quiz._id, answers);
  const elapsed = Date.now() - start.startedAt.getTime();
  const mock = { ...scoreMock(graded, quiz.marking || MARKING), late: elapsed > quiz.durationSeconds * 1000 + GRACE_MS };
  try {
    return await Attempt.create({
      user: user._id, quiz: quiz._id, answers: graded,
      score: mock.correct, total: graded.length,
      durationMs: Math.min(elapsed, quiz.durationSeconds * 1000), mock,
    });
  } catch (err) {
    if (err.code === 11000) throw conflict('You have already taken this mock test');
    throw err;
  }
}

/** Rank among on-time attempts: higher marks first, then faster. */
async function mockRanking(quizId, userId, { top = 10 } = {}) {
  const rows = await Attempt.find({ quiz: quizId, 'mock.late': { $ne: true } })
    .sort({ 'mock.marks': -1, durationMs: 1, submittedAt: 1 })
    .populate('user', 'name showOnLeaderboard')
    .select('user mock durationMs').lean();
  const participants = rows.length;
  const idx = userId ? rows.findIndex((r) => String(r.user?._id) === String(userId)) : -1;
  return {
    participants,
    rank: idx >= 0 ? idx + 1 : null,
    percentile: idx >= 0 && participants > 1 ? Math.round(((participants - idx - 1) / (participants - 1)) * 100) : null,
    top: rows.filter((r) => r.user && r.user.showOnLeaderboard !== false).slice(0, top).map((r) => ({
      name: displayName(r.user.name), marks: r.mock.marks, isMe: String(r.user._id) === String(userId),
    })),
  };
}

async function loadMock(quizId) {
  const quiz = await Quiz.findById(quizId).lean();
  if (!quiz || quiz.status !== 'published' || quiz.type !== 'mock') throw notFound('Mock test not found');
  return quiz;
}

module.exports = { MARKING, SECONDS_PER_QUESTION, scoreMock, assembleWeeklyMock, startMock, getStart, submitMock, mockRanking, loadMock };
