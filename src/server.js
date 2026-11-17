'use strict';
const config = require('./config');
const logger = require('./lib/logger');
const db = require('./lib/db');
const { createApp } = require('./app');

async function main() {
  await db.connect();
  const server = createApp().listen(config.port, () => logger.info({ port: config.port }, 'API listening'));

  const shutdown = (signal) => {
    logger.info({ signal }, 'Shutting down API');
    server.close(async () => {
      await db.disconnect();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  logger.fatal({ err }, 'API failed to start');
  process.exit(1);
});
