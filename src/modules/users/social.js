'use strict';
const config = require('../../config');
const { User } = require('./user.model');
const { signToken } = require('./auth.service');
const { AppError, unauthorized, badRequest } = require('../../lib/errors');

/**
 * Google and Apple sign-in. The app gets an ID token from Google or Apple and
 * sends it here; we verify its signature against the provider's public keys, its
 * issuer and its audience (our client IDs), then sign the user in.
 */
const PROVIDERS = {
  google: {
    jwksUrl: 'https://www.googleapis.com/oauth2/v3/certs',
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    audience: () => config.oauth.googleClientIds,
  },
  apple: {
    jwksUrl: 'https://appleid.apple.com/auth/keys',
    issuer: 'https://appleid.apple.com',
    audience: () => config.oauth.appleClientIds,
  },
};

const keySets = {};
let jose;
async function getJose() {
  jose = jose || require('jose');
  return jose;
}

/** Tests replace the provider's key set with a local one. */
function setKeySetForTests(provider, keySet) { keySets[provider] = keySet; }

async function verifyIdToken(provider, token) {
  const p = PROVIDERS[provider];
  const audience = p.audience();
  if (!audience.length) throw new AppError(503, 'not_configured', `${provider === 'google' ? 'Google' : 'Apple'} sign-in isn't set up on the server yet`);
  const { jwtVerify, createRemoteJWKSet } = await getJose();
  keySets[provider] = keySets[provider] || createRemoteJWKSet(new URL(p.jwksUrl));
  try {
    const { payload } = await jwtVerify(token, keySets[provider], { issuer: p.issuer, audience });
    return payload;
  } catch {
    throw unauthorized('Sign-in could not be verified. Please try again.');
  }
}

const isTrue = (v) => v === true || v === 'true';

/**
 * Finds or creates the account for a verified provider identity:
 * 1. an account already linked to this provider ID;
 * 2. otherwise an account with the same (provider-verified) email, which gets linked;
 * 3. otherwise a new account, with the email marked verified.
 */
async function signInWithProvider(provider, claims, { name } = {}) {
  const sub = claims.sub;
  const email = claims.email ? String(claims.email).toLowerCase() : null;
  const emailVerified = isTrue(claims.email_verified);

  let user = await User.findOne({ [`providers.${provider}`]: sub });
  if (!user && email && emailVerified) {
    user = await User.findOne({ email });
    if (user) {
      user.set(`providers.${provider}`, sub);
      user.emailVerified = true;
      await user.save();
    }
  }
  if (!user) {
    if (!email) throw badRequest('Your account did not share an email address. Please allow email access and try again.');
    user = await User.create({
      email,
      name: (name || claims.name || email.split('@')[0]).trim().slice(0, 100),
      emailVerified,
      hasPassword: false,
      providers: { [provider]: sub },
    });
  }
  if (user.disabled) throw unauthorized('This account has been disabled');
  user.lastLoginAt = new Date();
  await user.save();
  return { user, token: signToken(user) };
}

module.exports = { verifyIdToken, signInWithProvider, setKeySetForTests };
