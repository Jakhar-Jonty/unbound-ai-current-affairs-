'use strict';
const crypto = require('node:crypto');
const config = require('../../config');
const logger = require('../../lib/logger');
const { User } = require('../users/user.model');
const { Subscription, WebhookEvent } = require('./subscription.model');
const { AppError, badRequest, notFound } = require('../../lib/errors');

let client = null;
/** Razorpay SDK client (tests inject a fake with setClientForTests). */
function razorpay() {
  if (client) return client;
  if (!config.razorpay.keyId || !config.razorpay.keySecret) {
    throw new AppError(503, 'payments_not_configured', 'Payments aren’t set up yet. Please try again later.');
  }
  const Razorpay = require('razorpay');
  client = new Razorpay({ key_id: config.razorpay.keyId, key_secret: config.razorpay.keySecret });
  return client;
}
function setClientForTests(c) { client = c; }

function publicPlans() {
  return Object.entries(config.premium.plans).map(([id, p]) => ({
    id, label: p.label, period: p.period, amount: p.amount, currency: 'INR', display: `₹${(p.amount / 100).toLocaleString('en-IN')}`,
  }));
}

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

const toDate = (unix) => (unix ? new Date(unix * 1000) : undefined);

/** Recomputes the user's premium access from their subscriptions. */
async function syncUserPremium(userId) {
  const user = await User.findById(userId);
  if (!user || user.premium?.source === 'admin') return user; // Complimentary access is managed by admins.
  const subs = await Subscription.find({ user: userId }).sort({ currentEnd: -1 }).lean();
  // Paid time counts until the end of the period, including after a cancellation.
  // Halted (renewal payments failed), expired and never-paid subscriptions give no access.
  const paid = subs.find((s) => s.currentEnd && ['active', 'authenticated', 'cancelled', 'completed', 'pending'].includes(s.status));
  if (!paid) {
    if (user.premium?.until) {
      user.set('premium.status', subs[0]?.status === 'halted' ? 'halted' : 'ended');
      if (user.premium.until > new Date()) user.set('premium.until', new Date());
    }
  } else {
    user.premium = {
      plan: paid.plan,
      until: paid.currentEnd,
      source: 'razorpay',
      status: paid.status === 'cancelled' || paid.cancelAtCycleEnd ? 'cancelled' : 'active',
      razorpaySubscriptionId: paid.razorpaySubscriptionId,
    };
  }
  await user.save();
  return user;
}

/** Starts a Razorpay subscription; the app/web page then opens Razorpay Checkout with its id. */
async function createSubscription(user, planId) {
  const plan = config.premium.plans[planId];
  if (!plan) throw badRequest('Unknown plan');
  if (!plan.razorpayPlanId) throw new AppError(503, 'payments_not_configured', 'This plan isn’t available yet.');
  const sub = await razorpay().subscriptions.create({
    plan_id: plan.razorpayPlanId,
    total_count: plan.totalCount,
    customer_notify: 1,
    notes: { userId: String(user._id), plan: planId },
  });
  await Subscription.create({ user: user._id, razorpaySubscriptionId: sub.id, plan: planId, status: sub.status || 'created' });
  return {
    subscriptionId: sub.id,
    keyId: config.razorpay.keyId,
    plan: publicPlans().find((p) => p.id === planId),
    prefill: { name: user.name, email: user.email },
  };
}

/**
 * Called by the checkout page right after payment. Verifies Razorpay's signature
 * (HMAC of payment_id|subscription_id with our key secret) and grants access for
 * the first period straight away; webhooks then keep it up to date.
 */
async function verifyCheckout(user, { paymentId, subscriptionId, signature }) {
  const expected = crypto.createHmac('sha256', config.razorpay.keySecret).update(`${paymentId}|${subscriptionId}`).digest('hex');
  if (!safeEqual(expected, signature)) throw badRequest('Payment could not be verified');
  const sub = await Subscription.findOne({ razorpaySubscriptionId: subscriptionId, user: user._id });
  if (!sub) throw notFound('Subscription not found');
  let remote = null;
  try { remote = await razorpay().subscriptions.fetch(subscriptionId); } catch (err) { logger.warn({ err }, 'Could not fetch subscription after checkout'); }
  sub.status = remote?.status || 'active';
  sub.lastPaymentId = paymentId;
  sub.currentStart = toDate(remote?.current_start) || new Date();
  const fallbackEnd = new Date(Date.now() + (sub.plan === 'yearly' ? 366 : 31) * 86400000);
  sub.currentEnd = toDate(remote?.current_end) || fallbackEnd;
  if (sub.status === 'created' || sub.status === 'authenticated') sub.status = 'active';
  await sub.save();
  return syncUserPremium(user._id);
}

function verifyWebhookSignature(rawBody, signature) {
  if (!config.razorpay.webhookSecret) throw new AppError(503, 'payments_not_configured', 'Webhook secret not configured');
  const expected = crypto.createHmac('sha256', config.razorpay.webhookSecret).update(rawBody).digest('hex');
  return safeEqual(expected, signature || '');
}

/** Applies a Razorpay webhook. Each event is processed once (Razorpay may retry). */
async function handleWebhook({ rawBody, signature, eventId }) {
  if (!rawBody || !verifyWebhookSignature(rawBody, signature)) throw new AppError(400, 'bad_signature', 'Invalid signature');
  const body = JSON.parse(rawBody.toString('utf8'));
  const id = eventId || `${body.event}:${body.payload?.subscription?.entity?.id}:${body.created_at}`;
  try {
    await WebhookEvent.create({ _id: id, event: body.event });
  } catch (err) {
    if (err.code === 11000) return { duplicate: true };
    throw err;
  }
  const entity = body.payload?.subscription?.entity;
  if (!body.event?.startsWith('subscription.') || !entity) return { ignored: true };

  const sub = await Subscription.findOne({ razorpaySubscriptionId: entity.id });
  if (!sub) {
    logger.warn({ id: entity.id, event: body.event }, 'Webhook for unknown subscription');
    return { ignored: true };
  }
  sub.status = entity.status || sub.status;
  sub.currentStart = toDate(entity.current_start) || sub.currentStart;
  sub.currentEnd = toDate(entity.current_end) || sub.currentEnd;
  if (body.event === 'subscription.cancelled' && !entity.current_end) sub.currentEnd = new Date();
  sub.lastPaymentId = body.payload?.payment?.entity?.id || sub.lastPaymentId;
  sub.lastEvent = body.event;
  sub.lastEventAt = new Date();
  await sub.save();
  await syncUserPremium(sub.user);
  return { applied: body.event };
}

/** Cancels at the end of the paid period: access continues until then. */
async function cancelSubscription(user) {
  const sub = await Subscription.findOne({ user: user._id, status: { $in: ['active', 'authenticated', 'pending'] } }).sort({ createdAt: -1 });
  if (!sub) throw notFound('No active subscription');
  await razorpay().subscriptions.cancel(sub.razorpaySubscriptionId, true);
  sub.cancelAtCycleEnd = true;
  sub.status = 'cancelled';
  await sub.save();
  return syncUserPremium(user._id);
}

/** On account deletion: stop renewals immediately. */
async function cancelForDeletedUser(user) {
  const subs = await Subscription.find({ user: user._id, status: { $in: ['active', 'authenticated', 'pending', 'created'] } });
  for (const sub of subs) {
    await razorpay().subscriptions.cancel(sub.razorpaySubscriptionId, false);
    sub.status = 'cancelled';
    await sub.save();
  }
}

module.exports = {
  publicPlans, createSubscription, verifyCheckout, handleWebhook, cancelSubscription, cancelForDeletedUser,
  syncUserPremium, setClientForTests, verifyWebhookSignature,
};
