'use strict';
const express = require('express');
const { validate, z } = require('../../lib/validate');
const { requireAuth } = require('../users/auth.middleware');
const { DeviceToken } = require('./deviceToken.model');

const router = express.Router();

const registerSchema = z.object({
  token: z.string().trim().min(10).max(300),
  platform: z.enum(['ios', 'android', 'web']),
  appVersion: z.string().max(30).optional(),
});

// A device token belongs to whichever user most recently signed in on that device.
router.post('/me/devices', requireAuth, validate(registerSchema), async (req, res) => {
  const { token, platform, appVersion } = req.valid.body;
  await DeviceToken.findOneAndUpdate(
    { token },
    { $set: { user: req.user._id, platform, appVersion, lastSeenAt: new Date() } },
    { upsert: true },
  );
  res.status(204).end();
});

router.delete('/me/devices', requireAuth, validate(z.object({ token: z.string().min(1) })), async (req, res) => {
  await DeviceToken.deleteOne({ token: req.valid.body.token, user: req.user._id });
  res.status(204).end();
});

module.exports = router;
