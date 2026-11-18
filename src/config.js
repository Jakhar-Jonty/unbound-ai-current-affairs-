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
    // Play Store link shown on the website home page once the app is live.
    storeUrl: process.env.STORE_URL || '',
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
      translate: process.env.CRON_TRANSLATE || '40 */2 * * *',
      weeklyMock: process.env.CRON_WEEKLY_MOCK || '0 8 * * 0',
      mockReminder: process.env.CRON_MOCK_REMINDER || '0 18 * * 6',
      dailyReminder: process.env.CRON_DAILY_REMINDER || '0 20 * * *',
    },
    // Articles translated into Hindi per run (one AI call each).
    translateBatchSize: int('TRANSLATE_BATCH_SIZE', 5),
    mockSize: int('MOCK_SIZE', 50),
  },
  mail: {
    // Any SMTP provider, e.g. smtps://user:pass@smtp.example.com:465
    smtpUrl: process.env.SMTP_URL || '',
    from: process.env.MAIL_FROM || 'Unbound <no-reply@example.com>',
  },
  // Public base URL of this server (used for the premium checkout link), e.g. https://unbound.zonty.in
  publicUrl: (process.env.PUBLIC_URL || '').replace(/\/$/, ''),
  oauth: {
    // Comma-separated OAuth client IDs whose ID tokens we accept (web, iOS and Android clients).
    googleClientIds: (process.env.GOOGLE_CLIENT_IDS || '').split(',').map((s) => s.trim()).filter(Boolean),
    // Apple: the iOS bundle ID (and the Services ID if you add Apple sign-in on the web).
    appleClientIds: (process.env.APPLE_CLIENT_IDS || '').split(',').map((s) => s.trim()).filter(Boolean),
  },
  premium: {
    // While false, every feature is unlocked for everyone (use until payments are live).
    enabled: bool('PREMIUM_ENABLED', false),
    freeArchiveDays: int('FREE_ARCHIVE_DAYS', 30),
    freeBookmarks: int('FREE_BOOKMARKS', 20),
    freePracticePerDay: int('FREE_PRACTICE_PER_DAY', 10),
    plans: {
      monthly: { amount: int('PRICE_MONTHLY_PAISE', 4900), period: 'monthly', label: 'Monthly', razorpayPlanId: process.env.RAZORPAY_PLAN_MONTHLY || '', totalCount: 120 },
      yearly: { amount: int('PRICE_YEARLY_PAISE', 49900), period: 'yearly', label: 'Yearly', razorpayPlanId: process.env.RAZORPAY_PLAN_YEARLY || '', totalCount: 10 },
    },
    // Whether the app may open the web checkout. iOS must stay false (App Store rules).
    purchaseInApp: { android: bool('PREMIUM_PURCHASE_ANDROID', false), ios: false, web: true },
  },
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || '',
    keySecret: process.env.RAZORPAY_KEY_SECRET || '',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '',
  },
  // Shown on the privacy policy, terms, refund and contact pages. Set all of these before going live.
  legal: {
    appName: process.env.APP_NAME || 'Unbound Daily',
    operator: process.env.LEGAL_OPERATOR || '',          // person or company running the app
    contactEmail: process.env.LEGAL_CONTACT_EMAIL || '', // support and privacy requests
    grievanceOfficer: process.env.GRIEVANCE_OFFICER || '', // name required by India's IT Rules / DPDP Act
    address: process.env.LEGAL_ADDRESS || '',            // postal address (Razorpay needs one on the contact page)
    city: process.env.LEGAL_CITY || '',                  // courts for disputes
    effectiveDate: process.env.LEGAL_EFFECTIVE_DATE || '2026-11-18',
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
