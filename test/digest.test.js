'use strict';
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { setupDb, teardownDb, clearDb, makeUser, http } = require('./helpers');
const { Article } = require('../src/modules/content/article.model');
const { User } = require('../src/modules/users/user.model');
const { DeviceToken } = require('../src/modules/notifications/deviceToken.model');
const { sendDailyDigest } = require('../src/modules/notifications/reminders');
const { publishedArticles } = require('./fixtures');

before(() => setupDb(__filename));
after(teardownDb);
beforeEach(clearDb);

let t = 0;
async function deviceUser(props = {}) {
  const { user } = await makeUser();
  t += 1;
  await DeviceToken.create({ user: user.id, token: `ExponentPushToken[digest-${t}]`, platform: 'android' });
  if (Object.keys(props).length) await User.updateOne({ _id: user.id }, { $set: props });
  return user;
}
const fakeFetch = (log) => async (_url, init) => {
  const msgs = JSON.parse(init.body); log.push(...msgs);
  return { ok: true, json: async () => ({ data: msgs.map(() => ({ status: 'ok' })) }) };
};

test('skips the day when fewer than 3 stories were published', async () => {
  await publishedArticles(2);
  await deviceUser();
  const r = await sendDailyDigest({ fetchImpl: fakeFetch([]), enabled: true });
  assert.equal(r.skipped, 'few_articles');
});

test('one personalised digest per user, in their language, and never twice', async () => {
  const arts = await publishedArticles(5);
  await Article.updateMany({ _id: { $in: arts.slice(0, 3).map((a) => a._id) } }, { $set: { 'tags.exams': ['banking'] } });
  await Article.updateMany({ _id: { $in: arts.slice(3).map((a) => a._id) } }, { $set: { 'tags.exams': ['defence'] } });
  for (const a of arts.slice(0, 3)) await Article.updateOne({ _id: a._id }, { $set: { translations: { hi: { title: 'बैंकिंग ख़बर', summary: 'स', body: 'ब', keyPoints: ['क'], status: 'published', sourceVersion: a.version } } } });
  const banker = await deviceUser({ preferredExams: ['banking'], lang: 'hi' });
  const anyone = await deviceUser();
  const soldier = await deviceUser({ preferredExams: ['defence'] }); // only 2 stories for defence: too few
  const optedOut = await deviceUser({ 'notificationPrefs.digest': false });

  const log = [];
  const r = await sendDailyDigest({ fetchImpl: fakeFetch(log), enabled: true });
  assert.equal(r.articles, 5);
  assert.equal(r.tooFew, 1);
  assert.equal(log.length, 2, 'banker and anyone only');
  const hi = log.find((m) => m.title.includes('परीक्षाओं'));
  assert.ok(hi, 'banker gets Hindi, exam-specific title');
  assert.match(hi.title, /3/);
  assert.match(hi.body, /बैंकिंग ख़बर/);
  assert.equal(hi.data.type, 'digest');
  const en = log.find((m) => m.title === '5 new stories today');
  assert.ok(en, 'user without exams gets all 5');
  assert.match(en.body, /, and more$/);

  const again = [];
  await sendDailyDigest({ fetchImpl: fakeFetch(again), enabled: true });
  assert.equal(again.length, 0, 'deduplicated per day');
  void banker; void anyone; void soldier; void optedOut;
});

test('users can turn the digest off', async () => {
  const { auth } = await makeUser();
  const r = await http().patch('/api/v1/auth/me').set(auth).send({ notificationPrefs: { digest: false } });
  assert.equal(r.status, 200);
  assert.equal(r.body.user.notificationPrefs.digest, false);
  assert.equal(r.body.user.notificationPrefs.dailyReminder, true);
});
