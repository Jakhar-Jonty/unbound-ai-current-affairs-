'use strict';
process.env.NODE_ENV = 'test';
process.env.AI_PROVIDER = process.env.AI_PROVIDER || 'mock';
process.env.PIPELINE_FETCH_FULL_TEXT = 'false';
// Most tests exercise the editor review flow; auto-publish tests turn it on explicitly.
process.env.AUTO_PUBLISH = process.env.AUTO_PUBLISH || 'false';

const path = require('node:path');
const mongoose = require('mongoose');
const request = require('supertest');
const { createApp } = require('../src/app');
const { register } = require('../src/modules/users/auth.service');

const BASE_URI = process.env.MONGODB_URI_TEST || 'mongodb://127.0.0.1:27017';

/** Each test file gets its own database so files can run in parallel. */
async function setupDb(file) {
  const name = `ca_test_${path.basename(file, '.test.js').replace(/\W/g, '_')}`;
  await mongoose.connect(`${BASE_URI}/${name}`, { serverSelectionTimeoutMS: 5000 });
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
}

async function teardownDb() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}

async function clearDb() {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
}

let counter = 0;
async function makeUser(role = 'user') {
  counter += 1;
  const { user, token } = await register({ email: `${role}${counter}-${Date.now()}@example.com`, name: `${role} ${counter}`, password: 'password123', role });
  return { user, token, auth: { Authorization: `Bearer ${token}` } };
}

function rss(items) {
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>Test</title>${items.map((i) => `
    <item><title><![CDATA[${i.title}]]></title><link>${i.url}</link>
    <description><![CDATA[${i.description || 'Some description of the news.'}]]></description>
    <pubDate>${(i.publishedAt || new Date()).toUTCString()}</pubDate></item>`).join('')}
  </channel></rss>`;
}

/** Fake fetch that serves fixed bodies by URL. */
function fakeFetch(routes) {
  return async (url) => {
    const body = routes[url];
    if (body === undefined) return { ok: false, status: 404, text: async () => '' };
    return { ok: true, status: 200, text: async () => body, json: async () => JSON.parse(body) };
  };
}

const app = createApp();
const http = () => request(app);

/**
 * Waits until an email matching `predicate` is in the test outbox. Sign-up sends its
 * verification email in the background, so a fixed delay is flaky on a busy machine.
 */
async function waitForMail(predicate, timeoutMs = 3000) {
  const { outbox } = require('../src/lib/mailer');
  for (let waited = 0; waited < timeoutMs; waited += 20) {
    const mail = outbox.find(predicate);
    if (mail) return mail;
    await new Promise((res) => { setTimeout(res, 20); });
  }
  return undefined;
}

module.exports = { setupDb, teardownDb, clearDb, makeUser, rss, fakeFetch, http, waitForMail };
