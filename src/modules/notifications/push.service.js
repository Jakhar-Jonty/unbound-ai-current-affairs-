'use strict';
const mongoose = require('mongoose');
const config = require('../../config');
const logger = require('../../lib/logger');
const { DeviceToken, Notification } = require('./deviceToken.model');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CHUNK = 100; // Expo accepts up to 100 messages per request.

/** One row per (user, key) so a reminder is never sent twice, even if a job re-runs. Kept 30 days. */
const receiptSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, required: true },
  key: { type: String, required: true },
  at: { type: Date, default: Date.now, expires: 30 * 24 * 3600 },
});
receiptSchema.index({ user: 1, key: 1 }, { unique: true });
const PushReceipt = mongoose.model('PushReceipt', receiptSchema);

/**
 * Sends messages ({ to, title, body, data }) through the Expo push service in chunks.
 * Tokens Expo reports as DeviceNotRegistered are deleted. With PUSH_ENABLED false
 * nothing is sent (dry run) and the counts reflect what would have gone out.
 */
async function deliver(messages, { fetchImpl = fetch, enabled = config.push.enabled } = {}) {
  const stats = { sent: 0, failed: 0, removedTokens: 0 };
  if (!enabled) return { ...stats, dryRun: true, wouldSend: messages.length };
  for (let i = 0; i < messages.length; i += CHUNK) {
    const chunk = messages.slice(i, i + CHUNK);
    try {
      const res = await fetchImpl(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(config.push.expoAccessToken ? { Authorization: `Bearer ${config.push.expoAccessToken}` } : {}),
        },
        body: JSON.stringify(chunk.map((m) => ({ sound: 'default', ...m }))),
      });
      if (!res.ok) throw new Error(`Expo push responded ${res.status}`);
      const { data: tickets = [] } = await res.json();
      const dead = [];
      tickets.forEach((ticket, idx) => {
        if (ticket.status === 'ok') stats.sent += 1;
        else {
          stats.failed += 1;
          if (ticket.details?.error === 'DeviceNotRegistered') dead.push(chunk[idx].to);
        }
      });
      if (dead.length) stats.removedTokens += (await DeviceToken.deleteMany({ token: { $in: dead } })).deletedCount;
    } catch (err) {
      stats.failed += chunk.length;
      logger.error({ err }, 'Push chunk failed');
    }
  }
  return { ...stats, dryRun: false };
}

/** Sends a push notification to every registered device. */
async function broadcast({ title, body, data, createdBy }, opts = {}) {
  const tokens = await DeviceToken.find().select('token').lean();
  const stats = await deliver(tokens.map((t) => ({ to: t.token, title, body, data })), opts);
  const notification = await Notification.create({ title, body, data, createdBy, dryRun: stats.dryRun, sent: stats.sent, failed: stats.failed, removedTokens: stats.removedTokens });
  logger.info({ notificationId: notification._id, devices: tokens.length, ...stats }, 'Push broadcast');
  return { notification, devices: tokens.length, ...stats };
}

/**
 * Sends a personal message to each user, on all their devices, at most once per `key`.
 * `messageFor(user)` returns { title, body, data } (or null to skip that user).
 */
async function sendToUsers(users, key, messageFor, opts = {}) {
  const ids = users.map((u) => u._id);
  const already = new Set((await PushReceipt.find({ user: { $in: ids }, key }).select('user').lean()).map((r) => String(r.user)));
  const tokens = await DeviceToken.find({ user: { $in: ids } }).select('user token').lean();
  const byUser = new Map();
  for (const t of tokens) {
    if (!byUser.has(String(t.user))) byUser.set(String(t.user), []);
    byUser.get(String(t.user)).push(t.token);
  }
  const messages = [];
  const reached = [];
  for (const u of users) {
    const devices = byUser.get(String(u._id));
    if (!devices || already.has(String(u._id))) continue;
    const msg = messageFor(u);
    if (!msg) continue;
    reached.push(u._id);
    for (const to of devices) messages.push({ to, ...msg });
  }
  const stats = await deliver(messages, opts);
  // One history row per send (e.g. key "daily:2026-11-18"), like broadcasts.
  await Notification.create({
    title: key, body: `${reached.length} user(s), ${messages.length} device(s)`, audience: key,
    dryRun: stats.dryRun, sent: stats.sent, failed: stats.failed, removedTokens: stats.removedTokens,
  });
  if (!stats.dryRun && reached.length) {
    await PushReceipt.insertMany(reached.map((user) => ({ user, key })), { ordered: false }).catch((err) => { if (err.code !== 11000) throw err; });
  }
  return { users: reached.length, devices: messages.length, ...stats };
}

module.exports = { broadcast, sendToUsers, deliver, PushReceipt, EXPO_PUSH_URL };
