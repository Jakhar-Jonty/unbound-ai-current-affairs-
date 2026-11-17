// PM2 process file for the single-VPS deployment: `pm2 start ecosystem.config.js`.
// The API and the pipeline worker run as separate processes from the same code.
module.exports = {
  apps: [
    { name: 'ca-api', script: 'src/server.js', instances: 1, env: { NODE_ENV: 'production' }, max_memory_restart: '400M' },
    { name: 'ca-worker', script: 'src/worker.js', instances: 1, env: { NODE_ENV: 'production' }, max_memory_restart: '400M', kill_timeout: 65000 },
  ],
};
