'use strict';
/**
 * Pre-launch check of the production settings. Run on the server with the real .env:
 *   NODE_ENV=production npm run check:prod
 * Prints every problem and exits 1 if any must be fixed before going live.
 */
const config = require('../src/config');
const { missingLegal } = require('../src/modules/legal/legal.routes');

const errors = [];
const warnings = [];
const must = (ok, msg) => { if (!ok) errors.push(msg); };
const should = (ok, msg) => { if (!ok) warnings.push(msg); };

must(config.isProd, 'NODE_ENV must be "production"');
must(config.jwt.secret.length >= 32 && config.jwt.secret !== 'dev-only-insecure-secret', 'JWT_SECRET must be a random string of at least 32 characters (openssl rand -hex 32)');
must(!/127\.0\.0\.1|localhost/.test(config.mongoUri), 'MONGODB_URI points at localhost; use the production database');
must(/^https:\/\//.test(config.publicUrl), 'PUBLIC_URL must be the https address of this server, e.g. https://unbound.zonty.in');
must(Boolean(config.mail.smtpUrl), 'SMTP_URL is empty: sign-up, password reset and deletion codes would not be emailed');
must(!/example\.com/.test(config.mail.from), 'MAIL_FROM still uses example.com');
must(config.ai.provider !== 'mock', 'AI_PROVIDER is "mock": no real articles would be generated');
const aiKey = { claude: 'ANTHROPIC_API_KEY', anthropic: 'ANTHROPIC_API_KEY', openai: 'OPENAI_API_KEY', gemini: 'GEMINI_API_KEY', google: 'GEMINI_API_KEY' }[config.ai.provider];
must(!aiKey || Boolean(process.env[aiKey]), `${aiKey} is empty for AI_PROVIDER=${config.ai.provider}`);
for (const env of missingLegal()) must(false, `${env} is empty: the privacy policy and terms would show a "not set" marker`);
must(!config.legal.contactEmail || /@/.test(config.legal.contactEmail), 'LEGAL_CONTACT_EMAIL is not an email address');

should(config.push.enabled, 'PUSH_ENABLED is false: no reminders or quiz notifications will be sent');
should(config.corsOrigins.every((o) => !/localhost|127\.0\.0\.1/.test(o)), 'CORS_ORIGINS still lists localhost');
should(config.oauth.googleClientIds.length > 0, 'GOOGLE_CLIENT_IDS is empty: the Google button is hidden');
if (config.premium.enabled) {
  must(config.razorpay.keyId && config.razorpay.keySecret && config.razorpay.webhookSecret, 'PREMIUM_ENABLED is true but Razorpay keys or webhook secret are missing');
  must(config.premium.plans.monthly.razorpayPlanId && config.premium.plans.yearly.razorpayPlanId, 'PREMIUM_ENABLED is true but RAZORPAY_PLAN_MONTHLY / RAZORPAY_PLAN_YEARLY are empty (npm run razorpay:plans)');
  should(!/^rzp_test_/.test(config.razorpay.keyId), 'RAZORPAY_KEY_ID is a test key');
}

for (const w of warnings) console.log(`warn  ${w}`);
for (const e of errors) console.log(`FAIL  ${e}`);
if (errors.length) {
  console.log(`\n${errors.length} problem(s) to fix before going live.`);
  process.exit(1);
}
console.log(`\nOK: production settings look ready${warnings.length ? ` (${warnings.length} warning(s))` : ''}.`);
