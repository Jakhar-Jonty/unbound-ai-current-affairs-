'use strict';
const { Attempt } = require('../quiz/attempt.model');
const { weekRange } = require('../../lib/dates');

/** "Priya Sharma" -> "Priya S." so full names are never shown to other users. */
function displayName(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Aspirant';
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

/**
 * Weekly leaderboard from daily-quiz attempts submitted this week (Mon–Sun, app
 * timezone). Ranked by total correct answers; equal scores with equal question
 * counts share a rank. Users who opted out are excluded. Practice doesn't count.
 */
async function weeklyLeaderboard({ userId, limit = 50, date = new Date() } = {}) {
  const { start, end, startDate } = weekRange(date);
  const rows = await Attempt.aggregate([
    { $match: { submittedAt: { $gte: start, $lt: end } } },
    { $lookup: { from: 'quizzes', localField: 'quiz', foreignField: '_id', as: 'q', pipeline: [{ $project: { type: 1 } }] } },
    { $match: { 'q.type': 'daily' } },
    {
      $group: {
        _id: '$user', score: { $sum: '$score' }, total: { $sum: '$total' }, quizzes: { $sum: 1 }, lastAt: { $max: '$submittedAt' },
      },
    },
    { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u', pipeline: [{ $project: { name: 1, showOnLeaderboard: 1, disabled: 1 } }] } },
    { $unwind: '$u' },
    { $match: { 'u.disabled': { $ne: true }, 'u.showOnLeaderboard': { $ne: false } } },
    { $sort: { score: -1, total: 1, lastAt: 1 } },
  ]);

  let rank = 0;
  let prev = null;
  const ranked = rows.map((r, i) => {
    if (!prev || prev.score !== r.score || prev.total !== r.total) rank = i + 1;
    prev = r;
    return {
      rank,
      name: displayName(r.u.name),
      score: r.score,
      total: r.total,
      quizzes: r.quizzes,
      isMe: userId ? String(r._id) === String(userId) : false,
    };
  });
  const me = ranked.find((e) => e.isMe) || null;
  return { week: { start, end, startDate }, participants: ranked.length, entries: ranked.slice(0, limit), me };
}

module.exports = { weeklyLeaderboard, displayName };
