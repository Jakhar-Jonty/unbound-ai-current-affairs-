'use strict';
require('dotenv').config({ quiet: true });

function int(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  const n = Number.parseInt(v, 10);
  if (Number.isNaN(n)) throw new Error(`Environment variable ${name} must be an integer`);
  return n;
}

function bool(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
}

const env = process.env.NODE_ENV || 'development';

const config = {
  env,
  isTest: env === 'test',
  isProd: env === 'production',
  port: int('PORT', 4000),
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/current_affairs',
  jwt: {
    secret: process.env.JWT_SECRET || (env === 'production' ? '' : 'dev-only-insecure-secret'),
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  corsOrigins: (process.env.CORS_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean),
  timezone: process.env.APP_TIMEZONE || 'Asia/Kolkata',
  app: {
    minVersion: process.env.MIN_APP_VERSION || '1.0.0',
    latestVersion: process.env.LATEST_APP_VERSION || '1.0.0',
  },
  ai: {
    provider: (process.env.AI_PROVIDER || 'mock').toLowerCase(),
    model: process.env.AI_MODEL || '',
    maxOutputTokens: int('AI_MAX_OUTPUT_TOKENS', 16000),
  },
  pipeline: {
    batchSize: int('PIPELINE_BATCH_SIZE', 10),
    concurrency: int('PIPELINE_CONCURRENCY', 2),
    maxAttempts: int('PIPELINE_MAX_ATTEMPTS', 3),
    maxItemAgeHours: int('PIPELINE_MAX_ITEM_AGE_HOURS', 48),
    fetchFullText: bool('PIPELINE_FETCH_FULL_TEXT', true),
    feedsJson: process.env.FEEDS_JSON || '',
    dailyQuizSize: int('DAILY_QUIZ_SIZE', 10),
    cron: {
      ingest: process.env.CRON_INGEST || '0 */2 * * *',
      generate: process.env.CRON_GENERATE || '20 */2 * * *',
      dailyQuiz: process.env.CRON_DAILY_QUIZ || '0 7 * * *',
    },
  },
  push: {
    enabled: bool('PUSH_ENABLED', false),
    expoAccessToken: process.env.EXPO_ACCESS_TOKEN || '',
  },
};

if (config.isProd && (!config.jwt.secret || config.jwt.secret.length < 32)) {
  throw new Error('JWT_SECRET must be set to at least 32 characters in production');
}

module.exports = config;
