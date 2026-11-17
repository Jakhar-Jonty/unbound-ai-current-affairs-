'use strict';
const mongoose = require('mongoose');
const config = require('../config');
const logger = require('./logger');

mongoose.set('strictQuery', true);

async function connect(uri = config.mongoUri) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  logger.info({ db: mongoose.connection.name }, 'MongoDB connected');
  return mongoose.connection;
}

async function disconnect() {
  await mongoose.disconnect();
}

module.exports = { connect, disconnect, mongoose };
