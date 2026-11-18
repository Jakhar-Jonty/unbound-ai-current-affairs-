'use strict';
const config = require('../../config');
const { AppError } = require('../../lib/errors');

/**
 * Free vs premium. While PREMIUM_ENABLED is false, everyone has full access.
 *   Free: daily articles and quiz (last FREE_ARCHIVE_DAYS days), leaderboard,
 *         FREE_BOOKMARKS bookmarks, FREE_PRACTICE_PER_DAY practice questions a day.
 *   Premium: full archive, unlimited bookmarks and practice, offline reading,
 *            insights (and future AI tutor / audio briefings).
 */
function isPremium(user) {
  if (!config.premium.enabled) return true;
  return !!(user?.premium?.until && new Date(user.premium.until) > new Date());
}

function archiveCutoff() {
  return new Date(Date.now() - config.premium.freeArchiveDays * 86400000);
}

/** True when content published at `date` is outside the free window. */
function isArchive(date) {
  return config.premium.enabled && !!date && new Date(date) < archiveCutoff();
}

const FEATURES = {
  archive: 'Articles and quizzes older than {days} days are part of Premium.',
  bookmarks: 'Free accounts can save up to {bookmarks}. Upgrade for unlimited saves.',
  practice: 'You’ve used today’s free practice ({practice}). Upgrade for unlimited practice.',
  insights: 'Detailed insights into your weak topics are part of Premium.',
  offline: 'Offline reading is part of Premium.',
  audio: 'The daily audio briefing is part of Premium.',
};

function premiumRequired(feature) {
  const p = config.premium;
  const message = FEATURES[feature]
    .replace('{days}', p.freeArchiveDays)
    .replace('{bookmarks}', `${p.freeBookmarks} ${p.freeBookmarks === 1 ? 'item' : 'items'}`)
    .replace('{practice}', `${p.freePracticePerDay} ${p.freePracticePerDay === 1 ? 'question' : 'questions'}`);
  return new AppError(403, 'premium_required', message, { feature });
}

/** Limits that apply to this user (null = unlimited). */
function limitsFor(user) {
  const premium = isPremium(user);
  const p = config.premium;
  return {
    premium,
    archiveDays: premium ? null : p.freeArchiveDays,
    bookmarks: premium ? null : p.freeBookmarks,
    practicePerDay: premium ? null : p.freePracticePerDay,
    offline: premium,
    insights: premium,
    audio: premium,
  };
}

module.exports = { isPremium, isArchive, archiveCutoff, premiumRequired, limitsFor };
