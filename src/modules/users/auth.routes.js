'use strict';
const express = require('express');
const rateLimit = require('express-rate-limit');
const config = require('../../config');
const { validate, z } = require('../../lib/validate');
const { requireAuth } = require('./auth.middleware');
const auth = require('./auth.service');

const router = express.Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.isTest ? 1000 : 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
});

const registerSchema = z.object({
  email: z.email().max(200),
  name: z.string().trim().min(1).max(100),
  password: z.string().min(8).max(200),
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1).max(200),
});

router.post('/register', limiter, validate(registerSchema), async (req, res) => {
  const { user, token } = await auth.register(req.valid.body);
  res.status(201).json({ user: user.toPublic(), token });
});

router.post('/login', limiter, validate(loginSchema), async (req, res) => {
  const { user, token } = await auth.login(req.valid.body);
  res.json({ user: user.toPublic(), token });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user.toPublic() });
});

module.exports = router;
