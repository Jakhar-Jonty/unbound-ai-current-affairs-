'use strict';
const { User } = require('./user.model');
const { OneTimeCode, issueCode, consumeCode } = require('./codes');
const { Attempt, QuizStart } = require('../quiz/attempt.model');
const { Bookmark } = require('../bookmarks/bookmark.model');
const { DeviceToken } = require('../notifications/deviceToken.model');
const { PracticeAnswer } = require('../practice/practice.model');
const { sendMail } = require('../../lib/mailer');
const { badRequest } = require('../../lib/errors');
const logger = require('../../lib/logger');
const config = require('../../config');

/**
 * Deletes an account and everything tied to it. Subscription records (plan, dates,
 * Razorpay IDs) are kept for tax and accounting, as the privacy policy says; any
 * active subscription is cancelled first so there are no further charges.
 */
async function deleteAccount(user) {
  if (user.role === 'admin' && (await User.countDocuments({ role: 'admin', disabled: false })) <= 1) {
    throw badRequest('You are the only admin. Make someone else an admin before deleting this account.');
  }
  const uid = user._id;
  await require('../billing/billing.service').cancelForDeletedUser(user)
    .catch((err) => logger.error({ err }, 'Could not cancel subscription on account deletion'));
  const { PushReceipt } = require('../notifications/push.service');
  await Promise.all([
    Attempt.deleteMany({ user: uid }),
    QuizStart.deleteMany({ user: uid }),
    Bookmark.deleteMany({ user: uid }),
    DeviceToken.deleteMany({ user: uid }),
    OneTimeCode.deleteMany({ user: uid }),
    PracticeAnswer.deleteMany({ user: uid }),
    PushReceipt.deleteMany({ user: uid }),
  ]);
  await User.deleteOne({ _id: uid });
  logger.info({ user: String(uid) }, 'Account deleted');
}

/**
 * Web deletion (for people who no longer have the app; Google Play requires this).
 * Step 1 emails a code if the account exists; the response never says whether it does.
 */
async function requestDeletion(email) {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) return;
  const code = await issueCode(user._id, 'delete_account');
  if (!code) return; // Throttled.
  await sendMail({
    to: user.email,
    subject: `${code} is your account deletion code`,
    text: `Hi ${user.name},\n\nSomeone asked to delete your ${config.legal.appName} account. Your code is ${code}. It expires in 15 minutes.\n\nEntering it permanently deletes your account, quiz history, bookmarks and settings. This can't be undone.\n\nIf this wasn't you, ignore this email and nothing will change.`,
  });
}

/** Step 2: checks the code and deletes the account. */
async function confirmDeletion({ email, code }) {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) throw badRequest('That code is incorrect or has expired. Request a new one.');
  await consumeCode(user._id, 'delete_account', code);
  await deleteAccount(user);
}

module.exports = { deleteAccount, requestDeletion, confirmDeletion };
