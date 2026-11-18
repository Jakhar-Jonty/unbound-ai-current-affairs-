'use strict';
const crypto = require('node:crypto');
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setupDb, teardownDb, clearDb, http, makeUser, waitForMail } = require('./helpers');
const config = require('../src/config');
const { outbox } = require('../src/lib/mailer');
const social = require('../src/modules/users/social');
const billing = require('../src/modules/billing/billing.service');
const { User } = require('../src/modules/users/user.model');
const { Article } = require('../src/modules/content/article.model');
const { Question } = require('../src/modules/quiz/question.model');
const { publishedArticles } = require('./fixtures');

const saved = JSON.parse(JSON.stringify({ premium: config.premium, razorpay: config.razorpay, oauth: config.oauth }));
before(() => setupDb(__filename));
after(async () => { Object.assign(config, saved); await teardownDb(); });
beforeEach(async () => {
  await clearDb();
  outbox.length = 0;
  Object.assign(config.premium, JSON.parse(JSON.stringify(saved.premium)), { enabled: true });
});

const codeIn = (mail) => mail.subject.match(/^(\d{6})/)[1];

test('email verification with a code', async () => {
  const reg = await http().post('/api/v1/auth/register').send({ email: 'v@example.com', name: 'Vee', password: 'password123' });
  assert.equal(reg.body.user.emailVerified, false);
  const mail = await waitForMail((m) => /verification code/.test(m.subject));
  assert.ok(mail, 'verification email sent on sign-up');
  const auth = { Authorization: `Bearer ${reg.body.token}` };
  assert.equal((await http().post('/api/v1/auth/email/verify').set(auth).send({ code: codeIn(mail) === '000000' ? '111111' : '000000' })).status, 400);
  const ok = await http().post('/api/v1/auth/email/verify').set(auth).send({ code: codeIn(mail) });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.user.emailVerified, true);
  const again = await http().post('/api/v1/auth/email/send').set(auth);
  assert.equal(again.body.alreadyVerified, true);
});

// ---------- Google / Apple ----------
let jose;
async function makeIssuer(provider, aud, issuer) {
  jose = jose || require('jose');
  const { publicKey, privateKey } = await jose.generateKeyPair('RS256');
  const jwk = { ...(await jose.exportJWK(publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
  social.setKeySetForTests(provider, jose.createLocalJWKSet({ keys: [jwk] }));
  return (claims, opts = {}) => new jose.SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
    .setIssuer(opts.issuer || issuer).setAudience(opts.aud || aud)
    .setIssuedAt().setExpirationTime('10m')
    .sign(privateKey);
}

test('Google sign-in creates, reuses and links accounts', async () => {
  config.oauth.googleClientIds = [];
  assert.equal((await http().post('/api/v1/auth/google').send({ idToken: 'x'.repeat(40) })).status, 503, 'not configured');
  config.oauth.googleClientIds = ['web-client.apps.googleusercontent.com'];
  const sign = await makeIssuer('google', 'web-client.apps.googleusercontent.com', 'https://accounts.google.com');

  const t1 = await sign({ sub: 'g-123', email: 'Asha@Gmail.com', email_verified: true, name: 'Asha Rao' });
  const r1 = await http().post('/api/v1/auth/google').send({ idToken: t1 });
  assert.equal(r1.status, 200);
  assert.equal(r1.body.user.email, 'asha@gmail.com');
  assert.equal(r1.body.user.emailVerified, true);
  assert.equal(r1.body.user.hasPassword, false);
  assert.deepEqual(r1.body.user.signInMethods, ['google']);
  const r2 = await http().post('/api/v1/auth/google').send({ idToken: await sign({ sub: 'g-123', email: 'asha@gmail.com', email_verified: true }) });
  assert.equal(r2.body.user.id, r1.body.user.id, 'same account next time');

  // An existing email account gets linked when Google has verified the same email.
  const reg = await http().post('/api/v1/auth/register').send({ email: 'link@example.com', name: 'Link', password: 'password123' });
  const r3 = await http().post('/api/v1/auth/google').send({ idToken: await sign({ sub: 'g-999', email: 'link@example.com', email_verified: true }) });
  assert.equal(r3.body.user.id, reg.body.user.id);
  assert.deepEqual(r3.body.user.signInMethods, ['password', 'google']);

  // Wrong audience or issuer is rejected.
  assert.equal((await http().post('/api/v1/auth/google').send({ idToken: await sign({ sub: 'x' }, { aud: 'someone-else' }) })).status, 401);
  assert.equal((await http().post('/api/v1/auth/google').send({ idToken: await sign({ sub: 'x' }, { issuer: 'https://evil.example' }) })).status, 401);
  // Password login doesn't work for a Google-only account.
  assert.equal((await http().post('/api/v1/auth/login').send({ email: 'asha@gmail.com', password: 'anything-at-all' })).status, 401);
});

test('Apple sign-in uses the name sent by the app; passwordless accounts can set a password and delete with DELETE', async () => {
  config.oauth.appleClientIds = ['com.unbound.daily'];
  const sign = await makeIssuer('apple', 'com.unbound.daily', 'https://appleid.apple.com');
  const r = await http().post('/api/v1/auth/apple').send({ identityToken: await sign({ sub: 'a-1', email: 'xyz@privaterelay.appleid.com', email_verified: 'true' }), fullName: 'Ravi Kumar' });
  assert.equal(r.status, 200);
  assert.equal(r.body.user.name, 'Ravi Kumar');
  const auth = { Authorization: `Bearer ${r.body.token}` };

  const set = await http().post('/api/v1/auth/password/change').set(auth).send({ newPassword: 'my-new-password' });
  assert.equal(set.status, 200);
  assert.equal(set.body.user.hasPassword, true);

  const r2 = await http().post('/api/v1/auth/apple').send({ identityToken: await sign({ sub: 'a-2', email: 'other@privaterelay.appleid.com', email_verified: 'true' }) });
  const auth2 = { Authorization: `Bearer ${r2.body.token}` };
  assert.equal((await http().delete('/api/v1/auth/me').set(auth2).send({})).status, 400);
  assert.equal((await http().delete('/api/v1/auth/me').set(auth2).send({ confirm: 'DELETE' })).status, 204);
});

// ---------- Premium limits ----------
async function grantPremium(user, days = 30) {
  await User.updateOne({ _id: user._id }, { $set: { premium: { plan: 'complimentary', until: new Date(Date.now() + days * 86400000), source: 'admin', status: 'active' } } });
}

test('archive articles are premium; recent ones are free', async () => {
  const editor = await makeUser('editor');
  const [recent, old] = await publishedArticles(2, editor.user._id);
  await Article.updateOne({ _id: old._id }, { $set: { publishedAt: new Date(Date.now() - 40 * 86400000) } });
  const free = await makeUser();

  const list = await http().get('/api/v1/articles');
  assert.deepEqual(list.body.items.map((a) => a.premium).sort(), [false, true]);
  assert.equal((await http().get(`/api/v1/articles/${recent._id}`).set(free.auth)).status, 200);
  const locked = await http().get(`/api/v1/articles/${old._id}`).set(free.auth);
  assert.equal(locked.status, 403);
  assert.equal(locked.body.error.code, 'premium_required');
  assert.equal(locked.body.error.details.feature, 'archive');
  assert.equal(locked.body.error.details.teaser.title, old.title);
  assert.match(locked.headers['cache-control'], /no-store/);

  await grantPremium(free.user);
  assert.equal((await http().get(`/api/v1/articles/${old._id}`).set(free.auth)).status, 200);

  config.premium.enabled = false;
  assert.equal((await http().get(`/api/v1/articles/${old._id}`)).status, 200, 'everything unlocked when premium is off');
});

test('bookmark and practice limits for free accounts', async () => {
  config.premium.freeBookmarks = 2;
  config.premium.freePracticePerDay = 2;
  const editor = await makeUser('editor');
  const articles = await publishedArticles(3, editor.user._id);
  const free = await makeUser();
  for (const a of articles.slice(0, 2)) {
    assert.equal((await http().post('/api/v1/me/bookmarks').set(free.auth).send({ itemType: 'article', itemId: String(a._id) })).status, 201);
  }
  const third = await http().post('/api/v1/me/bookmarks').set(free.auth).send({ itemType: 'article', itemId: String(articles[2]._id) });
  assert.equal(third.status, 403);
  assert.equal(third.body.error.details.feature, 'bookmarks');
  assert.equal((await http().post('/api/v1/me/bookmarks').set(free.auth).send({ itemType: 'article', itemId: String(articles[0]._id) })).status, 201, 're-saving is fine');

  const set = await http().get('/api/v1/practice/questions?subject=polity').set(free.auth);
  assert.equal(set.body.remainingToday, 2);
  const qs = await Question.find({ _id: { $in: set.body.questions.map((q) => q.id) } }).lean();
  for (const q of qs.slice(0, 2)) {
    assert.equal((await http().post('/api/v1/practice/answers').set(free.auth).send({ questionId: String(q._id), selectedIndex: 0 })).status, 201);
  }
  const blocked = await http().post('/api/v1/practice/answers').set(free.auth).send({ questionId: String(qs[2]._id), selectedIndex: 0 });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.body.error.details.feature, 'practice');
  assert.equal((await http().get('/api/v1/practice/questions?subject=polity').set(free.auth)).status, 403);

  await grantPremium(free.user);
  assert.equal((await http().post('/api/v1/me/bookmarks').set(free.auth).send({ itemType: 'article', itemId: String(articles[2]._id) })).status, 201);
  const more = await http().get('/api/v1/practice/questions?subject=polity').set(free.auth);
  assert.equal(more.body.remainingToday, null);
});

test('insights are premium and summarise weak topics', async () => {
  const editor = await makeUser('editor');
  await publishedArticles(2, editor.user._id);
  const u = await makeUser();
  assert.equal((await http().get('/api/v1/me/insights').set(u.auth)).status, 403);
  await grantPremium(u.user);
  const set = await http().get('/api/v1/practice/questions?subject=polity').set(u.auth);
  for (const q of set.body.questions) await http().post('/api/v1/practice/answers').set(u.auth).send({ questionId: q.id, selectedIndex: 3 });
  const r = await http().get('/api/v1/me/insights').set(u.auth);
  assert.equal(r.status, 200);
  assert.equal(r.body.totals.answered, set.body.questions.length);
  assert.equal(r.body.weeks.length, 8);
  assert.ok(r.body.bySubject.find((x) => x.key === 'polity'));
  assert.ok(r.body.weakest.length >= 1);
  assert.ok(r.body.toRevisit.length >= 1, 'wrong answers to revisit');
});

test('admins can grant and remove complimentary premium', async () => {
  const admin = await makeUser('admin');
  const u = await makeUser();
  const until = new Date(Date.now() + 10 * 86400000).toISOString();
  const r = await http().patch(`/api/v1/admin/users/${u.user._id}`).set(admin.auth).send({ premiumUntil: until });
  assert.equal(r.status, 200);
  assert.equal((await http().get('/api/v1/billing/status').set(u.auth)).body.premium.active, true);
  await http().patch(`/api/v1/admin/users/${u.user._id}`).set(admin.auth).send({ premiumUntil: null });
  assert.equal((await http().get('/api/v1/billing/status').set(u.auth)).body.premium.active, false);
});

// ---------- Razorpay ----------
function fakeRazorpay(now = Math.floor(Date.now() / 1000)) {
  const calls = { created: [], cancelled: [] };
  const subs = {};
  return {
    calls,
    client: {
      subscriptions: {
        create: async (p) => { const id = `sub_${calls.created.length + 1}`; calls.created.push(p); subs[id] = { id, status: 'created' }; return subs[id]; },
        fetch: async (id) => ({ id, status: 'active', current_start: now, current_end: now + 30 * 86400 }),
        cancel: async (id, atEnd) => { calls.cancelled.push({ id, atEnd }); return { id, status: 'cancelled' }; },
      },
    },
  };
}

function configureRazorpay() {
  Object.assign(config.razorpay, { keyId: 'rzp_test_key', keySecret: 'test_secret', webhookSecret: 'whsec' });
  config.premium.plans.monthly.razorpayPlanId = 'plan_monthly';
  config.premium.plans.yearly.razorpayPlanId = 'plan_yearly';
}

const sigFor = (paymentId, subId) => crypto.createHmac('sha256', 'test_secret').update(`${paymentId}|${subId}`).digest('hex');

async function webhook(event, entity, id = crypto.randomUUID()) {
  const body = JSON.stringify({ event, created_at: Math.floor(Date.now() / 1000), payload: { subscription: { entity } } });
  const signature = crypto.createHmac('sha256', 'whsec').update(body).digest('hex');
  return http().post('/api/v1/billing/webhook').set('Content-Type', 'application/json').set('x-razorpay-signature', signature).set('x-razorpay-event-id', id).send(body);
}

test('plans endpoint shows ₹49 and ₹499', async () => {
  const r = await http().get('/api/v1/billing/plans');
  assert.deepEqual(r.body.plans.map((p) => [p.id, p.amount, p.display]), [['monthly', 4900, '₹49'], ['yearly', 49900, '₹499']]);
  assert.equal(r.body.purchaseAvailable.ios, false);
});

test('checkout: verified email, signature check, premium granted, webhooks keep it in sync', async () => {
  configureRazorpay();
  const fake = fakeRazorpay();
  billing.setClientForTests(fake.client);
  const u = await makeUser();

  const unverified = await http().post('/api/v1/billing/subscriptions').set(u.auth).send({ plan: 'monthly' });
  assert.equal(unverified.status, 403);
  assert.equal(unverified.body.error.code, 'email_not_verified');
  await User.updateOne({ _id: u.user._id }, { $set: { emailVerified: true } });

  // The checkout page signs in with a short-lived link token that only works for billing.
  const link = await http().post('/api/v1/billing/checkout-link').set(u.auth);
  const linkToken = link.body.url.split('#t=')[1];
  const linkAuth = { Authorization: `Bearer ${linkToken}` };
  assert.equal((await http().get('/api/v1/auth/me').set(linkAuth)).status, 401);

  const created = await http().post('/api/v1/billing/subscriptions').set(linkAuth).send({ plan: 'yearly' });
  assert.equal(created.status, 201);
  assert.equal(created.body.keyId, 'rzp_test_key');
  assert.equal(fake.calls.created[0].plan_id, 'plan_yearly');
  assert.equal(fake.calls.created[0].notes.userId, String(u.user._id));
  const subId = created.body.subscriptionId;

  const bad = await http().post('/api/v1/billing/verify').set(linkAuth).send({ razorpay_payment_id: 'pay_1', razorpay_subscription_id: subId, razorpay_signature: 'f'.repeat(64) });
  assert.equal(bad.status, 400);
  const ok = await http().post('/api/v1/billing/verify').set(linkAuth).send({ razorpay_payment_id: 'pay_1', razorpay_subscription_id: subId, razorpay_signature: sigFor('pay_1', subId) });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.user.premium.active, true);
  assert.equal(ok.body.user.premium.plan, 'yearly');

  // Webhooks: bad signature, renewal, duplicate delivery, then payment failure.
  const badHook = await http().post('/api/v1/billing/webhook').set('Content-Type', 'application/json').set('x-razorpay-signature', 'nope').send('{"event":"x"}');
  assert.equal(badHook.status, 400);
  const later = Math.floor(Date.now() / 1000) + 400 * 86400;
  assert.equal((await webhook('subscription.charged', { id: subId, status: 'active', current_start: 1, current_end: later }, 'evt_1')).body.applied, 'subscription.charged');
  assert.equal((await webhook('subscription.charged', { id: subId, status: 'active', current_end: later }, 'evt_1')).body.duplicate, true);
  let user = await User.findById(u.user._id);
  assert.equal(Math.floor(user.premium.until.getTime() / 1000), later);

  await webhook('subscription.halted', { id: subId, status: 'halted', current_end: later });
  user = await User.findById(u.user._id);
  assert.ok(user.premium.until <= new Date(), 'halted subscription ends access');
  billing.setClientForTests(null);
});

test('cancelling keeps access until the period ends; deleting the account stops renewals', async () => {
  configureRazorpay();
  const fake = fakeRazorpay();
  billing.setClientForTests(fake.client);
  const u = await makeUser();
  await User.updateOne({ _id: u.user._id }, { $set: { emailVerified: true } });
  const { body } = await http().post('/api/v1/billing/subscriptions').set(u.auth).send({ plan: 'monthly' });
  await http().post('/api/v1/billing/verify').set(u.auth).send({ razorpay_payment_id: 'pay_2', razorpay_subscription_id: body.subscriptionId, razorpay_signature: sigFor('pay_2', body.subscriptionId) });

  const c = await http().post('/api/v1/billing/cancel').set(u.auth);
  assert.equal(c.status, 200);
  assert.deepEqual(fake.calls.cancelled[0], { id: body.subscriptionId, atEnd: true });
  assert.equal(c.body.user.premium.active, true, 'paid time is kept');
  assert.equal(c.body.user.premium.status, 'cancelled');

  // A second subscriber deletes their account: renewals stop immediately.
  const v = await makeUser();
  await User.updateOne({ _id: v.user._id }, { $set: { emailVerified: true } });
  const s2 = await http().post('/api/v1/billing/subscriptions').set(v.auth).send({ plan: 'monthly' });
  await http().post('/api/v1/billing/verify').set(v.auth).send({ razorpay_payment_id: 'pay_3', razorpay_subscription_id: s2.body.subscriptionId, razorpay_signature: sigFor('pay_3', s2.body.subscriptionId) });
  assert.equal((await http().delete('/api/v1/auth/me').set(v.auth).send({ password: 'password123' })).status, 204);
  assert.deepEqual(fake.calls.cancelled[1], { id: s2.body.subscriptionId, atEnd: false });
  billing.setClientForTests(null);
});

test('meta reports premium and sign-in options', async () => {
  config.oauth.googleClientIds = ['x'];
  config.oauth.appleClientIds = [];
  const r = await http().get('/api/v1/meta');
  assert.deepEqual(r.body.premium, { enabled: true });
  assert.deepEqual(r.body.signIn, { google: true, apple: false });
});
