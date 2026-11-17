'use strict';
const config = require('../config');
const logger = require('./logger');

let transport = null;
const outbox = []; // Development/test only: last messages, for local testing.

function getTransport() {
  if (!config.mail.smtpUrl) return null;
  if (!transport) transport = require('nodemailer').createTransport(config.mail.smtpUrl);
  return transport;
}

/**
 * Sends an email through SMTP_URL. Without SMTP configured (local development and
 * tests) the message is kept in memory and logged instead. In production a missing
 * SMTP_URL is logged as an error, because users would not receive their codes.
 */
async function sendMail({ to, subject, text }) {
  const t = getTransport();
  if (t) {
    await t.sendMail({ from: config.mail.from, to, subject, text });
    return;
  }
  if (config.isProd) {
    logger.error({ subject }, 'SMTP_URL is not set; email not sent');
    return;
  }
  outbox.push({ to, subject, text, at: new Date() });
  if (outbox.length > 50) outbox.shift();
  logger.info({ to, subject, text }, 'Email (not sent: SMTP_URL not set)');
}

module.exports = { sendMail, outbox };
