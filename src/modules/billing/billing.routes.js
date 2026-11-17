'use strict';
const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const { validate, z } = require('../../lib/validate');
const { AppError } = require('../../lib/errors');
const { requireAuth } = require('../users/auth.middleware');
const { Subscription } = require('./subscription.model');
const { limitsFor } = require('./entitlements');
const billing = require('./billing.service');

const router = express.Router();

router.get('/billing/plans', (_req, res) => {
  const p = config.premium;
  res.json({
    enabled: p.enabled,
    plans: billing.publicPlans(),
    free: { archiveDays: p.freeArchiveDays, bookmarks: p.freeBookmarks, practicePerDay: p.freePracticePerDay },
    purchaseAvailable: { ...p.purchaseInApp, configured: !!(config.razorpay.keyId && p.plans.monthly.razorpayPlanId) },
  });
});

router.get('/billing/status', requireAuth, async (req, res) => {
  const sub = await Subscription.findOne({ user: req.user._id }).sort({ createdAt: -1 }).lean();
  res.json({
    premium: req.user.toPublic().premium,
    limits: limitsFor(req.user),
    subscription: sub ? { plan: sub.plan, status: sub.status, currentEnd: sub.currentEnd, cancelAtCycleEnd: !!sub.cancelAtCycleEnd } : null,
  });
});

/**
 * A short-lived link to the web checkout page, already signed in. The token is
 * in the URL fragment (never sent to servers or logged) and only works for /billing.
 */
router.post('/billing/checkout-link', requireAuth, (req, res) => {
  const token = jwt.sign({ sub: String(req.user._id), tv: req.user.tokenVersion || 0, scope: 'checkout' }, config.jwt.secret, { expiresIn: '15m', algorithm: 'HS256' });
  const base = config.publicUrl || `${req.protocol}://${req.get('host')}`;
  res.json({ url: `${base}/premium/#t=${token}`, expiresInSeconds: 900 });
});

router.post('/billing/subscriptions', requireAuth, validate(z.object({ plan: z.enum(['monthly', 'yearly']) })), async (req, res) => {
  if (!req.user.emailVerified) throw new AppError(403, 'email_not_verified', 'Please verify your email address first. Receipts are sent there.');
  if (limitsFor(req.user).premium && config.premium.enabled) throw new AppError(409, 'already_premium', 'You already have Premium.');
  res.status(201).json(await billing.createSubscription(req.user, req.valid.body.plan));
});

router.post('/billing/verify', requireAuth, validate(z.object({
  razorpay_payment_id: z.string().min(5).max(100),
  razorpay_subscription_id: z.string().min(5).max(100),
  razorpay_signature: z.string().min(10).max(200),
})), async (req, res) => {
  const b = req.valid.body;
  const user = await billing.verifyCheckout(req.user, { paymentId: b.razorpay_payment_id, subscriptionId: b.razorpay_subscription_id, signature: b.razorpay_signature });
  res.json({ user: user.toPublic() });
});

router.post('/billing/cancel', requireAuth, async (req, res) => {
  const user = await billing.cancelSubscription(req.user);
  res.json({ user: user.toPublic() });
});

// Razorpay → us. Authenticated by the webhook signature, not a user token.
router.post('/billing/webhook', async (req, res) => {
  const result = await billing.handleWebhook({
    rawBody: req.rawBody,
    signature: req.get('x-razorpay-signature'),
    eventId: req.get('x-razorpay-event-id'),
  });
  res.json({ ok: true, ...result });
});

module.exports = router;
