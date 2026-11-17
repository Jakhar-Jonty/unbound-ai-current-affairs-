'use strict';
const { User } = require('./user.model');
const { setPassword } = require('./auth.service');
const { sendMail } = require('../../lib/mailer');
const { badRequest } = require('../../lib/errors');
const { issueCode, consumeCode } = require('./codes');

/**
 * Emails a 6-digit code if the account exists. The response never reveals whether
 * an email is registered.
 */
async function requestReset(email) {
  const user = await User.findOne({ email: email.toLowerCase(), disabled: false });
  if (!user) return;
  const code = await issueCode(user._id, 'password_reset');
  if (!code) return; // Throttled.
  await sendMail({
    to: user.email,
    subject: `${code} is your password reset code`,
    text: `Hi ${user.name},\n\nYour password reset code is ${code}. It expires in 15 minutes.\n\nIf you didn't ask to reset your password, you can ignore this email.`,
  });
}

/** Checks the code and sets the new password. Returns a fresh session. */
async function resetPassword({ email, code, password }) {
  const user = await User.findOne({ email: email.toLowerCase(), disabled: false });
  if (!user) throw badRequest('That code is incorrect or has expired. Request a new one.');
  await consumeCode(user._id, 'password_reset', code);
  // Receiving the code proves the user controls the email address.
  if (!user.emailVerified) await User.updateOne({ _id: user._id }, { $set: { emailVerified: true } });
  return setPassword(user, password);
}

module.exports = { requestReset, resetPassword };
