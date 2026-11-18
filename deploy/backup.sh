#!/usr/bin/env bash
# Daily MongoDB backup. Installed as a cron job by setup-vps.sh.
# Keeps 30 days (the privacy policy promises deleted accounts leave backups within 30 days).
# Copy the files off the server too (e.g. rclone to cloud storage): a backup on the
# same machine doesn't survive losing the machine.
set -euo pipefail

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/srv/backups}"
URI="$(grep -E '^MONGODB_URI=' "$APP_DIR/.env" | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")"
[ -n "$URI" ] || { echo "MONGODB_URI not found in $APP_DIR/.env" >&2; exit 1; }

mkdir -p "$BACKUP_DIR"
umask 077
FILE="$BACKUP_DIR/unbound-$(date +%F).gz"
mongodump --uri="$URI" --gzip --archive="$FILE" --quiet
find "$BACKUP_DIR" -name 'unbound-*.gz' -mtime +30 -delete
echo "$(date -Is) backup ok: $FILE ($(du -h "$FILE" | cut -f1))"
