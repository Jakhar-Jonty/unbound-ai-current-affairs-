'use strict';
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const config = require('../../config');
const { User } = require('./user.model');
const { setPassword } = require('./auth.service');
const { sendMail } = require('../../lib/mailer');
const { badRequest, AppError } = require('../../lib/errors');

const CODE_TTL_MS = 15 * 60 * 1000;
const RESEND_AFTER_MS = 60 * 1000;
const MAX_TRIES = 5;

/** One pending reset per user. The code itself is never stored, only its HMAC. */
const resetSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  codeHash: { type: String, required: true },
  tries: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
});
resetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // MongoDB deletes expired codes.
const PasswordReset = mongoose.model('PasswordReset', resetSchema);

const hashCode = (code) => crypto.createHmac('sha256', config.jwt.secret).update(code).digest('hex');

/**
 * Emails a 6-digit code if the account exists. The response never reveals whether
 * an email is registered.
 */
async function requestReset(email) {
  const user = await User.findOne({ email: email.toLowerCase(), disabled: false });
  if (!user) return;
  const existing = await PasswordReset.findOne({ user: user._id });
  if (existing && Date.now() - existing.createdAt.getTime() < RESEND_AFTER_MS) return; // Throttle resends.

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await PasswordReset.findOneAndUpdate(
    { user: user._id },
    { $set: { codeHash: hashCode(code), tries: 0, createdAt: new Date(), expiresAt: new Date(Date.now() + CODE_TTL_MS) } },
    { upsert: true },
  );
  await sendMail({
    to: user.email,
    subject: `${code} is your password reset code`,
    text: `Hi ${user.name},\n\nYour password reset code is ${code}. It expires in 15 minutes.\n\nIf you didn't ask to reset your password, you can ignore this email.`,
  });
}

/** Checks the code and sets the new password. Returns a fresh session. */
async function resetPassword({ email, code, password }) {
  const invalid = () => badRequest('That code is incorrect or has expired. Request a new one.');
  const user = await User.findOne({ email: email.toLowerCase(), disabled: false });
  if (!user) throw invalid();
  const reset = await PasswordReset.findOne({ user: user._id });
  if (!reset || reset.expiresAt < new Date()) throw invalid();
  if (reset.tries >= MAX_TRIES) throw new AppError(429, 'too_many_attempts', 'Too many incorrect codes. Request a new one.');

  const a = Buffer.from(hashCode(code));
  const b = Buffer.from(reset.codeHash);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    await PasswordReset.updateOne({ _id: reset._id }, { $inc: { tries: 1 } });
    throw invalid();
  }
  await PasswordReset.deleteOne({ _id: reset._id });
  return setPassword(user, password);
}

module.exports = { requestReset, resetPassword, PasswordReset };
