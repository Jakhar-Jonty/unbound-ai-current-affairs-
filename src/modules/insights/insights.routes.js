'use strict';
const express = require('express');
const { requireAuth } = require('../users/auth.middleware');
const { isPremium, premiumRequired } = require('../billing/entitlements');
const { Attempt } = require('../quiz/attempt.model');
const { Question } = require('../quiz/question.model');
const { PracticeAnswer } = require('../practice/practice.model');
const { weekRange } = require('../../lib/dates');

const router = express.Router();
const DAY = 86400000;
const pct = (c, n) => (n ? Math.round((c / n) * 1000) / 10 : null);

/** All answers (daily quizzes + practice) from the last `days` days, newest first. */
async function recentAnswers(userId, days) {
  const since = new Date(Date.now() - days * DAY);
  const [attempts, practice] = await Promise.all([
    Attempt.find({ user: userId, submittedAt: { $gte: since } }).select('answers submittedAt').lean(),
    PracticeAnswer.find({ user: userId, answeredAt: { $gte: since } }).lean(),
  ]);
  const rows = [];
  for (const a of attempts) {
    for (const x of a.answers) {
      rows.push({ question: String(x.question), isCorrect: x.isCorrect, answered: x.selectedIndex !== null, subjects: x.subjects || [], gsPaper: x.gsPaper, at: a.submittedAt, timeMs: x.timeMs, source: 'quiz' });
    }
  }
  for (const p of practice) {
    rows.push({ question: String(p.question), isCorrect: p.isCorrect, answered: true, subjects: p.subjects || [], gsPaper: p.gsPaper, at: p.answeredAt, source: 'practice' });
  }
  return rows.sort((x, y) => y.at - x.at);
}

function tally(rows, keyFn) {
  const m = new Map();
  for (const r of rows) {
    for (const k of [].concat(keyFn(r)).filter(Boolean)) {
      const t = m.get(k) || { key: k, answered: 0, correct: 0, recent: 0, recentCorrect: 0, timeSum: 0, timeN: 0 };
      t.answered += 1;
      t.correct += r.isCorrect ? 1 : 0;
      if (Date.now() - r.at < 14 * DAY) { t.recent += 1; t.recentCorrect += r.isCorrect ? 1 : 0; }
      if (r.timeMs) { t.timeSum += r.timeMs; t.timeN += 1; }
      m.set(k, t);
    }
  }
  return [...m.values()].map((t) => {
    const accuracy = pct(t.correct, t.answered);
    const olderN = t.answered - t.recent;
    const older = pct(t.correct - t.recentCorrect, olderN);
    const recent = pct(t.recentCorrect, t.recent);
    return {
      key: t.key, answered: t.answered, correct: t.correct, accuracy,
      recentAccuracy: recent,
      trend: recent !== null && older !== null && t.recent >= 3 && olderN >= 3 ? Math.round((recent - older) * 10) / 10 : null,
      avgSeconds: t.timeN ? Math.round(t.timeSum / t.timeN / 100) / 10 : null,
    };
  });
}

/**
 * Premium: where the user is weak and what to do about it, from the last 90 days
 * of daily-quiz and practice answers.
 */
router.get('/me/insights', requireAuth, async (req, res) => {
  if (!isPremium(req.user)) throw premiumRequired('insights');
  const rows = await recentAnswers(req.user._id, 90);
  const answered = rows.length;
  const correct = rows.filter((r) => r.isCorrect).length;

  const bySubject = tally(rows, (r) => r.subjects).sort((a, b) => b.answered - a.answered);
  const byPaper = tally(rows, (r) => r.gsPaper).sort((a, b) => a.key.localeCompare(b.key));
  const weakest = bySubject.filter((s) => s.answered >= 3).sort((a, b) => a.accuracy - b.accuracy || b.answered - a.answered).slice(0, 3);

  // Last 8 weeks (Mon–Sun, IST).
  const weeks = [];
  let { start } = weekRange();
  for (let i = 0; i < 8; i += 1) {
    const from = new Date(start.getTime() - i * 7 * DAY);
    const to = new Date(from.getTime() + 7 * DAY);
    const w = rows.filter((r) => r.at >= from && r.at < to);
    weeks.unshift({ weekStart: from, answered: w.length, correct: w.filter((r) => r.isCorrect).length, accuracy: pct(w.filter((r) => r.isCorrect).length, w.length) });
  }

  // Questions most recently answered wrong and not answered correctly since.
  const latest = new Map();
  for (const r of rows) if (!latest.has(r.question)) latest.set(r.question, r);
  const wrongIds = [...latest.values()].filter((r) => !r.isCorrect && r.answered).slice(0, 10).map((r) => r.question);
  const qs = await Question.find({ _id: { $in: wrongIds }, status: 'published' }).select('stem article tags').lean();
  const byId = new Map(qs.map((q) => [String(q._id), q]));
  const toRevisit = wrongIds.map((id) => byId.get(id)).filter(Boolean)
    .map((q) => ({ id: q._id, stem: q.stem, article: q.article, subjects: q.tags?.subjects || [] }));

  const timed = rows.filter((r) => r.timeMs);
  res.json({
    periodDays: 90,
    totals: { answered, correct, accuracy: pct(correct, answered), avgSeconds: timed.length ? Math.round(timed.reduce((n, r) => n + r.timeMs, 0) / timed.length / 100) / 10 : null },
    weakest,
    bySubject,
    byPaper,
    weeks,
    toRevisit,
  });
});

module.exports = router;
