'use strict';
const express = require('express');
const rateLimit = require('express-rate-limit');
const config = require('../../config');
const { validate, z } = require('../../lib/validate');
const { requireAuth } = require('./auth.middleware');
const auth = require('./auth.service');
const reset = require('./passwordReset');
const verification = require('./emailVerification');
const social = require('./social');
const { OneTimeCode } = require('./codes');
const logger = require('../../lib/logger');
const { User } = require('./user.model');
const { Attempt } = require('../quiz/attempt.model');
const { Bookmark } = require('../bookmarks/bookmark.model');
const { DeviceToken } = require('../notifications/deviceToken.model');
// Wrong confirmation passwords are 400, not 401: a 401 tells the app the session ended.
const { badRequest } = require('../../lib/errors');

const router = express.Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.isTest ? 1000 : 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

const registerSchema = z.object({
  email: z.email().max(200),
  name: z.string().trim().min(1).max(100),
  password: z.string().min(8).max(200),
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(200),
});

router.post('/register', limiter, validate(registerSchema), async (req, res) => {
  const { user, token } = await auth.register(req.valid.body);
  // Send the verification code; a mail problem must not block sign-up.
  verification.sendVerification(user).catch((err) => logger.error({ err }, 'Verification email failed'));
  res.status(201).json({ user: user.toPublic(), token });
});

// ---------- Google / Apple ----------
router.post('/google', limiter, validate(z.object({ idToken: z.string().min(20).max(5000) })), async (req, res) => {
  const claims = await social.verifyIdToken('google', req.valid.body.idToken);
  const { user, token } = await social.signInWithProvider('google', claims);
  res.json({ user: user.toPublic(), token });
});

router.post('/apple', limiter, validate(z.object({
  identityToken: z.string().min(20).max(5000),
  // Apple sends the name only on the first sign-in, to the app, not in the token.
  fullName: z.string().trim().max(100).optional(),
})), async (req, res) => {
  const claims = await social.verifyIdToken('apple', req.valid.body.identityToken);
  const { user, token } = await social.signInWithProvider('apple', claims, { name: req.valid.body.fullName });
  res.json({ user: user.toPublic(), token });
});

// ---------- Email verification ----------
router.post('/email/send', requireAuth, limiter, async (req, res) => {
  if (req.user.emailVerified) return res.json({ sent: false, alreadyVerified: true });
  const sent = await verification.sendVerification(req.user);
  return res.status(202).json({ sent });
});

router.post('/email/verify', requireAuth, limiter, validate(z.object({ code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code') })), async (req, res) => {
  const user = await verification.verifyEmail(req.user, req.valid.body.code);
  res.json({ user: user.toPublic() });
});

router.post('/login', limiter, validate(loginSchema), async (req, res) => {
  const { user, token } = await auth.login(req.valid.body);
  res.json({ user: user.toPublic(), token });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user.toPublic() });
});

router.patch('/me', requireAuth, validate(z.object({
  name: z.string().trim().min(1).max(100).optional(),
  showOnLeaderboard: z.boolean().optional(),
})), async (req, res) => {
  const user = await User.findByIdAndUpdate(req.user._id, { $set: req.valid.body }, { returnDocument: 'after' });
  res.json({ user: user.toPublic() });
});

const password = z.string().min(8).max(200);

// Always 202, whether or not the email is registered.
router.post('/password/forgot', limiter, validate(z.object({ email: z.email() })), async (req, res) => {
  await reset.requestReset(req.valid.body.email);
  res.status(202).json({ ok: true });
});

router.post('/password/reset', limiter, validate(z.object({
  email: z.email(),
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code'),
  password,
})), async (req, res) => {
  const { user, token } = await reset.resetPassword(req.valid.body);
  res.json({ user: user.toPublic(), token });
});

// Accounts created with Google/Apple have no password yet and can set one without the current password.
router.post('/password/change', requireAuth, limiter, validate(z.object({ currentPassword: z.string().optional(), newPassword: password })), async (req, res) => {
  const { currentPassword, newPassword } = req.valid.body;
  if (req.user.hasPassword !== false && !(await auth.checkPassword(req.user, currentPassword || ''))) throw badRequest('Your current password is incorrect');
  const { user, token } = await auth.setPassword(req.user, newPassword);
  res.json({ user: user.toPublic(), token });
});

/**
 * Permanently deletes the account and the user's personal data (attempts,
 * bookmarks, devices). Required by the App Store for apps with sign-up.
 */
router.delete('/me', requireAuth, limiter, validate(z.object({ password: z.string().optional(), confirm: z.string().optional() })), async (req, res) => {
  if (req.user.hasPassword === false) {
    // Google/Apple-only accounts confirm by typing DELETE.
    if (req.valid.body.confirm !== 'DELETE') throw badRequest('Type DELETE to confirm');
  } else if (!(await auth.checkPassword(req.user, req.valid.body.password || ''))) {
    throw badRequest('Your password is incorrect');
  }
  if (req.user.role === 'admin' && (await User.countDocuments({ role: 'admin', disabled: false })) <= 1) {
    throw badRequest('You are the only admin. Make someone else an admin before deleting this account.');
  }
  const uid = req.user._id;
  // Stop future charges before the account goes.
  await require('../billing/billing.service').cancelForDeletedUser(req.user).catch((err) => logger.error({ err }, 'Could not cancel subscription on account deletion'));
  await Promise.all([
    Attempt.deleteMany({ user: uid }),
    Bookmark.deleteMany({ user: uid }),
    DeviceToken.deleteMany({ user: uid }),
    OneTimeCode.deleteMany({ user: uid }),
    require('../practice/practice.model').PracticeAnswer.deleteMany({ user: uid }),
  ]);
  await User.deleteOne({ _id: uid });
  res.status(204).end();
});

module.exports = router;
