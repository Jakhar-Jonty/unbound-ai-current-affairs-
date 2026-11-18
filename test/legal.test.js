'use strict';
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setupDb, teardownDb, clearDb, http, waitForMail } = require('./helpers');
const config = require('../src/config');
const { outbox } = require('../src/lib/mailer');
const { User } = require('../src/modules/users/user.model');
const { Bookmark } = require('../src/modules/bookmarks/bookmark.model');
const { Attempt, QuizStart } = require('../src/modules/quiz/attempt.model');
const { PushReceipt } = require('../src/modules/notifications/push.service');
const { DeviceToken } = require('../src/modules/notifications/deviceToken.model');
const { publishedArticles } = require('./fixtures');
const { missingLegal } = require('../src/modules/legal/legal.routes');

const savedLegal = { ...config.legal };
before(() => setupDb(__filename));
after(async () => { Object.assign(config.legal, savedLegal); await teardownDb(); });
beforeEach(async () => { await clearDb(); outbox.length = 0; Object.assign(config.legal, savedLegal); });

const codeFrom = (mail) => mail.subject.match(/^(\d{6})/)[1];

test('legal pages render in English and Hindi with configured details', async () => {
  Object.assign(config.legal, { operator: 'Test Operator', contactEmail: 'support@example.com', grievanceOfficer: 'G. Officer', address: '1 Test Road', city: 'Jaipur' });
  for (const path of ['/', '/privacy', '/terms', '/refunds', '/contact', '/delete-account']) {
    const r = await http().get(path);
    assert.equal(r.status, 200, path);
    assert.match(r.headers['content-type'], /text\/html/);
    assert.match(r.text, /<html lang="en">/);
    assert.doesNotMatch(r.text, /<mark>/, `${path} has no unset placeholders`);
    const hi = await http().get(`${path}?lang=hi`);
    assert.match(hi.text, /<html lang="hi">/);
  }
  const privacy = await http().get('/privacy');
  assert.match(privacy.text, /support@example\.com/);
  assert.match(privacy.text, /Grievance Officer: G\. Officer/);
  assert.match((await http().get('/terms')).text, /courts at Jaipur/);
  assert.match((await http().get('/privacy?lang=hi')).text, /गोपनीयता नीति/);
  assert.match((await http().get('/delete-account')).text, /src="\/legal\/delete\.js"/);
  assert.equal((await http().get('/legal/delete.js')).status, 200);
  assert.deepEqual(missingLegal(), []);
});

test('unset legal details are flagged on the page and by the launch check', async () => {
  Object.assign(config.legal, { operator: '', contactEmail: '', grievanceOfficer: '', address: '', city: '' });
  const r = await http().get('/privacy');
  assert.match(r.text, /<mark>\[not set: LEGAL_CONTACT_EMAIL\]<\/mark>/);
  assert.deepEqual(missingLegal().sort(), ['GRIEVANCE_OFFICER', 'LEGAL_ADDRESS', 'LEGAL_CITY', 'LEGAL_CONTACT_EMAIL', 'LEGAL_OPERATOR']);
});

test('values are escaped', async () => {
  Object.assign(config.legal, { operator: '<script>x</script>' });
  const r = await http().get('/terms');
  assert.doesNotMatch(r.text, /<script>x<\/script>/);
  assert.match(r.text, /&lt;script&gt;/);
});

test('web account deletion: code by email, then everything tied to the account is removed', async () => {
  const reg = await http().post('/api/v1/auth/register').send({ email: 'gone@example.com', name: 'Gone User', password: 'password123' });
  await waitForMail((m) => m.to === 'gone@example.com');
  outbox.length = 0;
  const uid = reg.body.user.id;
  const [article] = await publishedArticles(1);
  await Bookmark.create({ user: uid, itemType: 'article', item: article._id, itemModel: 'Article' });
  await PushReceipt.create({ user: uid, key: 'x' });
  await DeviceToken.create({ user: uid, token: 'ExponentPushToken[gone]', platform: 'android' });
  await QuizStart.create({ user: uid, quiz: article._id });

  // Unknown email: same answer, no email.
  const unknown = await http().post('/api/v1/auth/delete/request').send({ email: 'nobody@example.com' });
  assert.equal(unknown.status, 202);
  assert.equal(outbox.length, 0);

  assert.equal((await http().post('/api/v1/auth/delete/request').send({ email: 'Gone@Example.com' })).status, 202);
  const mail = await waitForMail((m) => /account deletion code/.test(m.subject));
  assert.ok(mail);
  assert.equal(await Bookmark.countDocuments({ user: uid }), 1);
  const code = codeFrom(mail);

  const wrong = await http().post('/api/v1/auth/delete/confirm').send({ email: 'gone@example.com', code: code === '000000' ? '111111' : '000000' });
  assert.equal(wrong.status, 400);
  assert.ok(await User.exists({ _id: uid }), 'wrong code deletes nothing');

  const ok = await http().post('/api/v1/auth/delete/confirm').send({ email: 'gone@example.com', code });
  assert.equal(ok.status, 204);
  assert.equal(await User.exists({ _id: uid }), null);
  assert.equal(await Bookmark.countDocuments({ user: uid }), 0);
  assert.equal(await PushReceipt.countDocuments({ user: uid }), 0);
  assert.equal(await DeviceToken.countDocuments({ user: uid }), 0);
  assert.equal(await QuizStart.countDocuments({ user: uid }), 0);
  assert.equal(await Attempt.countDocuments({ user: uid }), 0);

  const again = await http().post('/api/v1/auth/delete/confirm').send({ email: 'gone@example.com', code });
  assert.equal(again.status, 400);
});

test('a code issued for another purpose cannot delete an account', async () => {
  await http().post('/api/v1/auth/register').send({ email: 'keep@example.com', name: 'Keep', password: 'password123' });
  await waitForMail((m) => m.to === 'keep@example.com');
  outbox.length = 0;
  await http().post('/api/v1/auth/password/forgot').send({ email: 'keep@example.com' });
  const reset = await waitForMail((m) => /password reset code/.test(m.subject));
  const r = await http().post('/api/v1/auth/delete/confirm').send({ email: 'keep@example.com', code: codeFrom(reset) });
  assert.equal(r.status, 400);
  assert.ok(await User.exists({ email: 'keep@example.com' }));
});
