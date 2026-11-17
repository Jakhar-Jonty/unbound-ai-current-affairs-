'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { setupDb, teardownDb, http, makeUser } = require('./helpers');

before(() => setupDb(__filename));
after(teardownDb);

test('register, login and fetch profile', async () => {
  const reg = await http().post('/api/v1/auth/register').send({ email: 'Asha@Example.com', name: 'Asha', password: 'secret-pass-1' });
  assert.equal(reg.status, 201);
  assert.equal(reg.body.user.email, 'asha@example.com');
  assert.equal(reg.body.user.role, 'user');
  assert.ok(reg.body.token);
  assert.equal(reg.body.user.passwordHash, undefined);

  const dup = await http().post('/api/v1/auth/register').send({ email: 'asha@example.com', name: 'Asha', password: 'secret-pass-1' });
  assert.equal(dup.status, 409);

  const bad = await http().post('/api/v1/auth/login').send({ email: 'asha@example.com', password: 'wrong-password' });
  assert.equal(bad.status, 401);

  const login = await http().post('/api/v1/auth/login').send({ email: 'asha@example.com', password: 'secret-pass-1' });
  assert.equal(login.status, 200);

  const me = await http().get('/api/v1/auth/me').set('Authorization', `Bearer ${login.body.token}`);
  assert.equal(me.status, 200);
  assert.equal(me.body.user.name, 'Asha');
});

test('rejects invalid input and bad tokens', async () => {
  const r = await http().post('/api/v1/auth/register').send({ email: 'not-an-email', name: '', password: 'short' });
  assert.equal(r.status, 400);
  assert.equal(r.body.error.code, 'bad_request');

  const me = await http().get('/api/v1/auth/me').set('Authorization', 'Bearer garbage');
  assert.equal(me.status, 401);
});

test('admin routes need editor role; user management needs admin', async () => {
  const user = await makeUser('user');
  const editor = await makeUser('editor');
  assert.equal((await http().get('/api/v1/admin/articles').set(user.auth)).status, 403);
  assert.equal((await http().get('/api/v1/admin/articles').set(editor.auth)).status, 200);
  assert.equal((await http().get('/api/v1/admin/users').set(editor.auth)).status, 403);
  const admin = await makeUser('admin');
  assert.equal((await http().get('/api/v1/admin/users').set(admin.auth)).status, 200);
});

test('meta and health endpoints', async () => {
  const meta = await http().get('/api/v1/meta');
  assert.equal(meta.status, 200);
  assert.ok(meta.body.minAppVersion);
  const health = await http().get('/health');
  assert.equal(health.status, 200);
  assert.equal(health.body.db, 'up');
});
