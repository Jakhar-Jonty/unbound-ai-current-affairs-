'use strict';
const { User } = require('./user.model');
const { verifyToken } = require('./auth.service');
const { unauthorized, forbidden } = require('../../lib/errors');

async function resolveUser(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw unauthorized('Invalid or expired token');
  }
  const user = await User.findById(payload.sub);
  if (!user || user.disabled) throw unauthorized('Account not found or disabled');
  if ((payload.tv || 0) !== (user.tokenVersion || 0)) throw unauthorized('Your session has ended. Please sign in again.');
  // Checkout-link tokens only work for billing.
  if (payload.scope === 'checkout' && !req.originalUrl.startsWith('/api/v1/billing/')) throw unauthorized('This link only works for checkout');
  return user;
}

/** Requires a valid bearer token. Sets req.user. */
async function requireAuth(req, _res, next) {
  const user = await resolveUser(req);
  if (!user) throw unauthorized();
  req.user = user;
  next();
}

/** Sets req.user when a valid token is present; continues anonymously otherwise. */
async function optionalAuth(req, _res, next) {
  req.user = await resolveUser(req);
  next();
}

const RANK = { user: 0, editor: 1, admin: 2 };

/** Requires the authenticated user to have at least `role`. Use after requireAuth. */
function requireRole(role) {
  return (req, _res, next) => {
    if (!req.user) throw unauthorized();
    if (RANK[req.user.role] < RANK[role]) throw forbidden();
    next();
  };
}

module.exports = { requireAuth, optionalAuth, requireRole };
