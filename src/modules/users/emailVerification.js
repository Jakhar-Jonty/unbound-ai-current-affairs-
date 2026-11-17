'use strict';
const { User } = require('./user.model');
const { sendMail } = require('../../lib/mailer');
const { issueCode, consumeCode } = require('./codes');

/** Sends a verification code. Returns false when throttled or already verified. */
async function sendVerification(user) {
  if (user.emailVerified) return false;
  const code = await issueCode(user._id, 'verify_email');
  if (!code) return false;
  await sendMail({
    to: user.email,
    subject: `${code} is your verification code`,
    text: `Hi ${user.name},\n\nWelcome! Enter ${code} in the app to verify your email address. The code expires in 15 minutes.`,
  });
  return true;
}

async function verifyEmail(user, code) {
  await consumeCode(user._id, 'verify_email', code);
  return User.findByIdAndUpdate(user._id, { $set: { emailVerified: true } }, { returnDocument: 'after' });
}

module.exports = { sendVerification, verifyEmail };
