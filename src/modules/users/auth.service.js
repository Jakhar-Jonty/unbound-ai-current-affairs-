'use strict';
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../../config');
const { User } = require('./user.model');
const { conflict, unauthorized } = require('../../lib/errors');

const BCRYPT_ROUNDS = config.isTest ? 4 : 12;

function signToken(user) {
  return jwt.sign({ sub: String(user._id), role: user.role }, config.jwt.secret, {
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
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
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

module.exports = { register, login, signToken, verifyToken };
