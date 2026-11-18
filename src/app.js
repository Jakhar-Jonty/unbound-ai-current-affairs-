'use strict';
const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const mongoose = require('mongoose');
const { ZodError, z } = require('zod');
const config = require('./config');
const logger = require('./lib/logger');
const { AppError } = require('./lib/errors');

function errorHandler(err, req, res, _next) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: { code: 'bad_request', message: 'Invalid request', details: z.flattenError(err) } });
  }
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message, details: err.details } });
  }
  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({ error: { code: 'validation_error', message: err.message } });
  }
  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).json({ error: { code: 'bad_request', message: `Invalid ${err.path}` } });
  }
  if (err?.code === 11000) {
    return res.status(409).json({ error: { code: 'conflict', message: 'Duplicate value' } });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'bad_request', message: 'Malformed JSON body' } });
  }
  logger.error({ err, path: req.path }, 'Unhandled error');
  return res.status(500).json({ error: { code: 'internal', message: 'Something went wrong' } });
}

function createApp() {
  const app = express();
  app.set('trust proxy', 1); // Behind nginx on the VPS.
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(cors({ origin: config.corsOrigins.length ? config.corsOrigins : false }));
  // Keep the raw body for webhook signature checks.
  app.use(express.json({ limit: '200kb', verify: (req, _res, buf) => { if (req.originalUrl.startsWith('/api/v1/billing/webhook')) req.rawBody = buf; } }));

  app.get('/health', (_req, res) => {
    const dbUp = mongoose.connection.readyState === 1;
    res.status(dbUp ? 200 : 503).json({ status: dbUp ? 'ok' : 'degraded', db: dbUp ? 'up' : 'down' });
  });

  const v1 = express.Router();
  // Lets the mobile app force an update when the API needs a newer client.
  v1.get('/meta', (_req, res) => {
    res.json({
      minAppVersion: config.app.minVersion,
      latestAppVersion: config.app.latestVersion,
      timezone: config.timezone,
      premium: { enabled: config.premium.enabled },
      signIn: { google: config.oauth.googleClientIds.length > 0, apple: config.oauth.appleClientIds.length > 0 },
    });
  });
  v1.use('/auth', require('./modules/users/auth.routes'));
  v1.use(require('./modules/content/content.routes'));
  v1.use(require('./modules/quiz/quiz.routes'));
  v1.use(require('./modules/bookmarks/bookmark.routes'));
  v1.use(require('./modules/notifications/notification.routes'));
  v1.use(require('./modules/leaderboard/leaderboard.routes'));
  v1.use(require('./modules/practice/practice.routes'));
  v1.use(require('./modules/billing/billing.routes'));
  v1.use(require('./modules/insights/insights.routes'));
  v1.use(require('./modules/briefing/briefing.routes'));
  v1.use('/admin', require('./modules/admin/admin.routes'));
  app.use('/api/v1', v1);

  // Premium checkout page (web). Razorpay Checkout needs its script and frames allowed.
  app.use('/premium', (_req, res, next) => {
    res.setHeader('Content-Security-Policy', [
      "default-src 'self'",
      "script-src 'self' https://checkout.razorpay.com",
      "frame-src https://api.razorpay.com https://checkout.razorpay.com",
      "connect-src 'self' https://api.razorpay.com https://lumberjack.razorpay.com",
      "img-src 'self' data: https:",
      "style-src 'self' 'unsafe-inline'",
      "frame-ancestors 'none'",
    ].join('; '));
    res.setHeader('Referrer-Policy', 'no-referrer');
    next();
  }, express.static(path.join(__dirname, '..', 'public', 'premium'), { index: 'index.html' }));

  // Admin panel (static, talks to /api/v1/admin).
  app.use('/admin', express.static(path.join(__dirname, '..', 'public', 'admin'), { index: 'index.html' }));

  app.use((_req, res) => res.status(404).json({ error: { code: 'not_found', message: 'Route not found' } }));
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
