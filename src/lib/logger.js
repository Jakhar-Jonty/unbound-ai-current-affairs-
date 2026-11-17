'use strict';
const pino = require('pino');
const config = require('../config');

module.exports = pino({
  level: process.env.LOG_LEVEL || (config.isTest ? 'silent' : 'info'),
  redact: ['req.headers.authorization', 'password', '*.password', '*.passwordHash'],
});
