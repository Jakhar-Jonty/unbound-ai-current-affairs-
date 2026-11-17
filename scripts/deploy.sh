#!/usr/bin/env bash
# Updates the server to the latest main and restarts both processes.
# Run on the VPS from the app folder: ./scripts/deploy.sh
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "Local changes in $(pwd); commit or discard them first." >&2
  exit 1
fi

git fetch --quiet origin
git checkout --quiet main
git merge --ff-only origin/main
npm ci --omit=dev --no-audit --no-fund

# reload restarts the API without dropping requests; the worker finishes its job first.
pm2 reload ecosystem.config.js --update-env
pm2 save

sleep 3
if curl -fsS http://127.0.0.1:4000/health; then
  echo
  echo "Deployed $(git log -1 --format='%h %s')"
else
  echo "Health check failed; see: pm2 logs ca-api --lines 50" >&2
  exit 1
fi
