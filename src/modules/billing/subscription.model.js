'use strict';
const mongoose = require('mongoose');

/** A Razorpay subscription and its latest known state. */
const subscriptionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    razorpaySubscriptionId: { type: String, required: true, unique: true },
    plan: { type: String, enum: ['monthly', 'yearly'], required: true },
    // created | authenticated | active | pending | halted | cancelled | completed | expired
    status: { type: String, required: true },
    currentStart: Date,
    currentEnd: Date,
    cancelAtCycleEnd: Boolean,
    lastPaymentId: String,
    lastEvent: String,
    lastEventAt: Date,
  },
  { timestamps: true },
);

/** Webhook event IDs already handled (Razorpay retries deliveries). Kept for 30 days. */
const webhookEventSchema = new mongoose.Schema({
  _id: String,
  event: String,
  receivedAt: { type: Date, default: Date.now, expires: 30 * 24 * 3600 },
});

module.exports = {
  Subscription: mongoose.model('Subscription', subscriptionSchema),
  WebhookEvent: mongoose.model('WebhookEvent', webhookEventSchema),
};
