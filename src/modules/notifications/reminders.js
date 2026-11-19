'use strict';
const { User } = require('../users/user.model');
const { DeviceToken } = require('./deviceToken.model');
const { Quiz } = require('../quiz/quiz.model');
const { Attempt } = require('../quiz/attempt.model');
const { PracticeAnswer } = require('../practice/practice.model');
const { computeStreak } = require('../quiz/quiz.service');
const { localDateString } = require('../../lib/dates');
const { sendToUsers, broadcast } = require('./push.service');

/** Push texts in each user's language. */
const TEXT = {
  streak: {
    en: (n) => ({ title: `Don’t lose your ${n}-day streak`, body: 'Today’s current affairs quiz takes about 5 minutes.' }),
    hi: (n) => ({ title: `अपनी ${n} दिन की लय न टूटने दें`, body: 'आज का करेंट अफेयर्स क्विज़ लगभग 5 मिनट का है।' }),
  },
  daily: {
    en: () => ({ title: 'Today’s quiz is waiting', body: 'Five minutes on today’s news, with explanations.' }),
    hi: () => ({ title: 'आज का क्विज़ आपका इंतज़ार कर रहा है', body: 'आज की खबरों पर 5 मिनट, व्याख्या के साथ।' }),
  },
  dailyOpen: {
    en: (n) => ({ title: 'Today’s current affairs quiz is live', body: `${n} questions from the latest news. Takes about 5 minutes.` }),
    hi: (n) => ({ title: 'आज का करेंट अफेयर्स क्विज़ उपलब्ध है', body: `ताज़ा खबरों से ${n} प्रश्न। लगभग 5 मिनट लगेंगे।` }),
  },
  mockOpen: {
    en: (n) => ({ title: 'This week’s mock test is live', body: `${n} questions from the week’s news, with negative marking.` }),
    hi: (n) => ({ title: 'इस सप्ताह का मॉक टेस्ट उपलब्ध है', body: `सप्ताह की खबरों से ${n} प्रश्न, नकारात्मक अंकन के साथ।` }),
  },
  mockLast: {
    en: () => ({ title: 'Last day for this week’s mock test', body: 'A new one starts tomorrow morning. See where you stand.' }),
    hi: () => ({ title: 'इस सप्ताह के मॉक टेस्ट का आखिरी दिन', body: 'कल सुबह नया टेस्ट आएगा। देखें आप कहाँ खड़े हैं।' }),
  },
};
const say = (kind, user, arg) => TEXT[kind][user.lang === 'hi' ? 'hi' : 'en'](arg);

/** Users with at least one device who were active in the last `days` days. */
async function reachableUsers(filter, days = 14) {
  const withDevices = await DeviceToken.distinct('user');
  const since = new Date(Date.now() - days * 86400000);
  const [recentAttempts, recentPractice] = await Promise.all([
    Attempt.distinct('user', { submittedAt: { $gte: since }, user: { $in: withDevices } }),
    PracticeAnswer.distinct('user', { answeredAt: { $gte: since }, user: { $in: withDevices } }),
  ]);
  const active = new Set([...recentAttempts, ...recentPractice].map(String));
  const users = await User.find({
    _id: { $in: withDevices }, disabled: { $ne: true }, ...filter,
    $or: [{ lastLoginAt: { $gte: since } }, { _id: { $in: [...active] } }],
  }).select('lang notificationPrefs').lean();
  return users;
}

/** Current streak per user, from quiz attempts and practice in the last 60 days. */
async function streaks(userIds) {
  const since = new Date(Date.now() - 60 * 86400000);
  const [a, p] = await Promise.all([
    Attempt.find({ user: { $in: userIds }, submittedAt: { $gte: since } }).select('user submittedAt').lean(),
    PracticeAnswer.find({ user: { $in: userIds }, answeredAt: { $gte: since } }).select('user answeredAt').lean(),
  ]);
  const days = new Map();
  const add = (u, d) => { const k = String(u); if (!days.has(k)) days.set(k, []); days.get(k).push(localDateString(d)); };
  a.forEach((x) => add(x.user, x.submittedAt));
  p.forEach((x) => add(x.user, x.answeredAt));
  return new Map([...days].map(([k, d]) => [k, computeStreak(d).current]));
}

/**
 * Evening reminder for active users who haven't taken today's daily quiz:
 * "Don't lose your N-day streak" when they have one, otherwise a gentle nudge.
 */
async function sendDailyReminders(opts = {}) {
  const date = localDateString();
  const quiz = await Quiz.findOne({ type: 'daily', date, status: 'published' }).select('_id').lean();
  if (!quiz) return { skipped: 'no_quiz_today' };
  const users = await reachableUsers({ 'notificationPrefs.dailyReminder': { $ne: false } });
  const done = new Set((await Attempt.distinct('user', { quiz: quiz._id })).map(String));
  const pending = users.filter((u) => !done.has(String(u._id)));
  const streakOf = await streaks(pending.map((u) => u._id));
  const result = await sendToUsers(pending, `daily:${date}`, (u) => {
    const n = streakOf.get(String(u._id)) || 0;
    return { ...(n > 0 ? say('streak', u, n) : say('daily', u)), data: { type: 'quiz', quizId: String(quiz._id) } };
  }, opts);
  return { candidates: pending.length, ...result };
}

/** Morning: today's quiz is live (every user with a device, in their language). */
async function sendDailyOpen(quiz, opts = {}) {
  const withDevices = await DeviceToken.distinct('user');
  const users = await User.find({ _id: { $in: withDevices }, disabled: { $ne: true } }).select('lang').lean();
  return sendToUsers(users, `daily-open:${quiz._id}`, (u) => ({ ...say('dailyOpen', u, quiz.questions.length), data: { type: 'quiz', quizId: String(quiz._id) } }), opts);
}

/** Sunday: the new mock test is out (everyone who hasn't turned mock alerts off). */
async function sendMockOpen(quiz, opts = {}) {
  const users = await reachableUsers({ 'notificationPrefs.mock': { $ne: false } }, 60);
  return sendToUsers(users, `mock-open:${quiz._id}`, (u) => ({ ...say('mockOpen', u, quiz.questions.length), data: { type: 'mock', quizId: String(quiz._id) } }), opts);
}

/** Saturday: reminder for people who haven't taken this week's mock yet. */
async function sendMockReminders(opts = {}) {
  const quiz = await Quiz.findOne({ type: 'mock', status: 'published' }).sort({ publishedAt: -1 }).lean();
  if (!quiz || Date.now() - quiz.publishedAt.getTime() > 7 * 86400000) return { skipped: 'no_current_mock' };
  const users = await reachableUsers({ 'notificationPrefs.mock': { $ne: false } });
  const done = new Set((await Attempt.distinct('user', { quiz: quiz._id })).map(String));
  const pending = users.filter((u) => !done.has(String(u._id)));
  const result = await sendToUsers(pending, `mock-last:${quiz._id}`, (u) => ({ ...say('mockLast', u), data: { type: 'mock', quizId: String(quiz._id) } }), opts);
  return { candidates: pending.length, ...result };
}

module.exports = { sendDailyOpen, sendDailyReminders, sendMockOpen, sendMockReminders, TEXT, broadcast };
