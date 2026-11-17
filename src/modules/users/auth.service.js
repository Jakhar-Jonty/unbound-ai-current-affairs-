'use strict';
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const { User } = require('./user.model');
const { conflict, unauthorized } = require('../../lib/errors');

const BCRYPT_ROUNDS = config.isTest ? 4 : 12;

function signToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role, tv: user.tokenVersion || 0 }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
    algorithm: 'HS256',
  });
}

function verifyToken(token) {
  return jwt.verify(token, config.jwt.secret, { algorithms: ['HS256'] });
}

async function register({ email, name, password, role = 'user' }) {
  const existing = await User.exists({ email: email.toLowerCase() });
  if (existing) throw conflict('An account with this email already exists');
  const passwordHash = await hashPassword(password);
  const user = await User.create({ email, name, passwordHash, role });
  return { user, token: signToken(user) };
}

async function login({ email, password }) {
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  // Compare against a dummy hash when the user is missing to keep timing similar.
  const hash = user?.passwordHash || '$2a$04$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva';
  const ok = await bcrypt.compare(password, hash);
  if (!user || !ok || user.disabled) throw unauthorized('Invalid email or password');
  user.lastLoginAt = new Date();
  await user.save();
  return { user, token: signToken(user) };
}

async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

async function checkPassword(user, password) {
  const withHash = user.passwordHash ? user : await User.findById(user._id).select('+passwordHash');
  return bcrypt.compare(password, withHash.passwordHash);
}

/** Sets a new password and signs out every other session. Returns a fresh token. */
async function setPassword(user, password) {
  const passwordHash = await hashPassword(password);
  const updated = await User.findByIdAndUpdate(
    user._id,
    { $set: { passwordHash }, $inc: { tokenVersion: 1 } },
    { returnDocument: 'after' },
  );
  return { user: updated, token: signToken(updated) };
}

module.exports = { register, login, signToken, verifyToken, hashPassword, checkPassword, setPassword, BCRYPT_ROUNDS };
