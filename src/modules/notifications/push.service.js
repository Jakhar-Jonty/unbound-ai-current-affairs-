'use strict';
const config = require('../../config');
const logger = require('../../lib/logger');
const { DeviceToken, Notification } = require('./deviceToken.model');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CHUNK = 100; // Expo accepts up to 100 messages per request.

/**
 * Sends a push notification to every registered device via the Expo push service
 * (works for the React Native / Expo app on both iOS and Android). Tokens that Expo
 * reports as DeviceNotRegistered are deleted. When PUSH_ENABLED is false the
 * notification is recorded but nothing is sent (dry run).
 */
async function broadcast({ title, body, data, createdBy }, { fetchImpl = fetch, enabled = config.push.enabled } = {}) {
  const tokens = await DeviceToken.find().select('token').lean();
  const stats = { sent: 0, failed: 0, removedTokens: 0 };

  if (enabled) {
    for (let i = 0; i < tokens.length; i += CHUNK) {
      const chunk = tokens.slice(i, i + CHUNK);
      const messages = chunk.map((t) => ({ to: t.token, title, body, data, sound: 'default' }));
      try {
        const res = await fetchImpl(EXPO_PUSH_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(config.push.expoAccessToken ? { Authorization: `Bearer ${config.push.expoAccessToken}` } : {}),
          },
          body: JSON.stringify(messages),
        });
        if (!res.ok) throw new Error(`Expo push responded ${res.status}`);
        const { data: tickets = [] } = await res.json();
        const dead = [];
        tickets.forEach((ticket, idx) => {
          if (ticket.status === 'ok') stats.sent += 1;
          else {
            stats.failed += 1;
            if (ticket.details?.error === 'DeviceNotRegistered') dead.push(chunk[idx].token);
          }
        });
        if (dead.length) {
          const r = await DeviceToken.deleteMany({ token: { $in: dead } });
          stats.removedTokens += r.deletedCount;
        }
      } catch (err) {
        stats.failed += chunk.length;
        logger.error({ err }, 'Push chunk failed');
      }
    }
  }

  const notification = await Notification.create({ title, body, data, createdBy, dryRun: !enabled, ...stats });
  logger.info({ notificationId: notification._id, devices: tokens.length, ...stats, dryRun: !enabled }, 'Push broadcast');
  return { notification, devices: tokens.length, ...stats };
}

module.exports = { broadcast, EXPO_PUSH_URL };
