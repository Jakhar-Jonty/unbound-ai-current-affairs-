'use strict';
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const config = require('../../config');
const { badRequest, AppError } = require('../../lib/errors');

/**
 * Short-lived 6-digit codes sent by email (password reset, email verification).
 * Only an HMAC of the code is stored; codes are single use, expire, allow a limited
 * number of tries and can't be re-sent more than once a minute.
 */
const PURPOSES = ['password_reset', 'verify_email'];
const TTL_MS = 15 * 60 * 1000;
const RESEND_AFTER_MS = 60 * 1000;
const MAX_TRIES = 5;

const codeSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  purpose: { type: String, enum: PURPOSES, required: true },
  codeHash: { type: String, required: true },
  tries: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true },
});
codeSchema.index({ user: 1, purpose: 1 }, { unique: true });
codeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // MongoDB removes expired codes.
const OneTimeCode = mongoose.model('OneTimeCode', codeSchema);

const hashCode = (code) => crypto.createHmac('sha256', config.jwt.secret).update(code).digest('hex');

/** Returns a new code, or null when one was issued less than a minute ago. */
async function issueCode(userId, purpose) {
  const existing = await OneTimeCode.findOne({ user: userId, purpose });
  if (existing && Date.now() - existing.createdAt.getTime() < RESEND_AFTER_MS) return null;
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await OneTimeCode.findOneAndUpdate(
    { user: userId, purpose },
    { $set: { codeHash: hashCode(code), tries: 0, createdAt: new Date(), expiresAt: new Date(Date.now() + TTL_MS) } },
    { upsert: true },
  );
  return code;
}

/** Checks and consumes a code. Throws a user-facing error when it doesn't match. */
async function consumeCode(userId, purpose, code) {
  const invalid = () => badRequest('That code is incorrect or has expired. Request a new one.');
  const doc = await OneTimeCode.findOne({ user: userId, purpose });
  if (!doc || doc.expiresAt < new Date()) throw invalid();
  if (doc.tries >= MAX_TRIES) throw new AppError(429, 'too_many_attempts', 'Too many incorrect codes. Request a new one.');
  const a = Buffer.from(hashCode(String(code)));
  const b = Buffer.from(doc.codeHash);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    await OneTimeCode.updateOne({ _id: doc._id }, { $inc: { tries: 1 } });
    throw invalid();
  }
  await OneTimeCode.deleteOne({ _id: doc._id });
}

module.exports = { OneTimeCode, issueCode, consumeCode };
