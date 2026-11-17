'use strict';
const express = require('express');
const { optionalAuth } = require('../users/auth.middleware');
const { weeklyLeaderboard } = require('./leaderboard.service');

const router = express.Router();

router.get('/leaderboard/weekly', optionalAuth, async (req, res) => {
  res.set('Cache-Control', 'private, max-age=30');
  res.json(await weeklyLeaderboard({ userId: req.user?._id }));
});

module.exports = router;
