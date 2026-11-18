#!/usr/bin/env bash
# One-time setup of a fresh Ubuntu 24.04 VPS for Unbound Daily.
#
# From your computer, copy it up and run it as root (it asks for a password once):
#   scp deploy/setup-vps.sh root@SERVER_IP:
#   ssh root@SERVER_IP
#   CI_DEPLOY_KEY='ssh-ed25519 AAAA... github-actions' bash setup-vps.sh
# CI_DEPLOY_KEY is the public half of the GitHub Actions key (optional; can be added later
# by running the script again).
#
# Safe to run again. It does NOT write .env, request the HTTPS certificate or start
# the app: those need your secrets and DNS, and the script prints the commands.
set -euo pipefail

DOMAIN="${DOMAIN:-unbounddaily.zonty.in}"
REPO="${REPO:-https://github.com/Jakhar-Jonty/unbound-ai-current-affairs-.git}"
APP_DIR=/srv/unbound
BACKUP_DIR=/srv/backups
USER_NAME=deploy

[ "$(id -u)" -eq 0 ] || { echo "Run as root." >&2; exit 1; }
. /etc/os-release
[ "${VERSION_CODENAME:-}" = noble ] || echo "Warning: written for Ubuntu 24.04 (noble); this is ${PRETTY_NAME:-unknown}." >&2
export DEBIAN_FRONTEND=noninteractive
step() { printf '\n==> %s\n' "$*"; }

step "System packages"
apt-get update -q
apt-get upgrade -yq
apt-get install -yq git curl ca-certificates gnupg nginx certbot python3-certbot-nginx ufw fail2ban unattended-upgrades

step "Automatic security updates"
dpkg-reconfigure -f noninteractive unattended-upgrades

step "Node.js 22 and pm2"
if ! node -v 2>/dev/null | grep -q '^v22\.'; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -yq nodejs
fi
command -v pm2 >/dev/null || npm install -g pm2
node -v

step "MongoDB database tools (mongodump for backups)"
if ! command -v mongodump >/dev/null; then
  curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-8.0.gpg
  echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse" > /etc/apt/sources.list.d/mongodb-org-8.0.list
  apt-get update -q
  apt-get install -yq mongodb-database-tools
fi

step "Swap (helps npm ci on 1 GB machines)"
if [ "$(swapon --show | wc -l)" -eq 0 ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

step "User '$USER_NAME'"
if ! id "$USER_NAME" >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" "$USER_NAME"
  usermod -aG sudo "$USER_NAME"
  echo "Set a password for $USER_NAME (needed for sudo):"
  passwd "$USER_NAME"
fi
install -d -m 700 -o "$USER_NAME" -g "$USER_NAME" "/home/$USER_NAME/.ssh"
AUTH="/home/$USER_NAME/.ssh/authorized_keys"
touch "$AUTH"
# Your own key: copy root's so you can log in as deploy with the same key.
if [ -f /root/.ssh/authorized_keys ]; then
  while IFS= read -r key; do
    [ -n "$key" ] && ! grep -qF "$key" "$AUTH" && echo "$key" >> "$AUTH"
  done < /root/.ssh/authorized_keys
fi
# GitHub Actions key: may only run the deploy script, nothing else.
if [ -n "${CI_DEPLOY_KEY:-}" ] && ! grep -qF "$CI_DEPLOY_KEY" "$AUTH"; then
  echo "command=\"$APP_DIR/scripts/deploy.sh\",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty $CI_DEPLOY_KEY" >> "$AUTH"
fi
chown "$USER_NAME:$USER_NAME" "$AUTH" && chmod 600 "$AUTH"

step "Code in $APP_DIR"
install -d -o "$USER_NAME" -g "$USER_NAME" "$APP_DIR" "$BACKUP_DIR"
if [ ! -d "$APP_DIR/.git" ]; then
  sudo -u "$USER_NAME" git clone "$REPO" "$APP_DIR"
fi
sudo -u "$USER_NAME" bash -c "cd $APP_DIR && npm ci --omit=dev --no-audit --no-fund"

step "pm2 on boot (as $USER_NAME)"
env PATH="$PATH:/usr/bin" pm2 startup systemd -u "$USER_NAME" --hp "/home/$USER_NAME" >/dev/null
sudo -u "$USER_NAME" pm2 install pm2-logrotate >/dev/null 2>&1 || true
sudo -u "$USER_NAME" pm2 set pm2-logrotate:retain 30 >/dev/null 2>&1 || true

step "nginx site for $DOMAIN"
sed -E "s/^([[:space:]]*server_name)[[:space:]].*;/\1 $DOMAIN;/" "$APP_DIR/deploy/nginx.conf" > /etc/nginx/sites-available/unbound
ln -sf /etc/nginx/sites-available/unbound /etc/nginx/sites-enabled/unbound
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

step "Firewall"
ufw allow OpenSSH >/dev/null
ufw allow 'Nginx Full' >/dev/null
ufw --force enable

step "Daily database backup (03:30, keeps 30 days)"
cat > /etc/cron.d/unbound-backup <<EOF
30 3 * * * $USER_NAME $APP_DIR/deploy/backup.sh >> $BACKUP_DIR/backup.log 2>&1
EOF

step "SSH hardening"
if [ -s "$AUTH" ] && grep -qv '^command=' "$AUTH"; then
  # 01- so it wins over cloud-init's 50-cloud-init.conf (sshd uses the first value it reads).
  cat > /etc/ssh/sshd_config.d/01-unbound.conf <<'EOF'
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
EOF
  sshd -t && systemctl reload ssh
  echo "Root and password logins are now off. Log in as: ssh $USER_NAME@<server>"
else
  echo "Skipped: $USER_NAME has no personal SSH key yet, so root login stays on."
fi

cat <<EOF

Done. Next, as $USER_NAME (ssh $USER_NAME@<server>):

  1. Point DNS: A record for $DOMAIN -> this server's IP, then wait for: dig +short $DOMAIN
  2. cd $APP_DIR && cp .env.example .env && chmod 600 .env && nano .env
     NODE_ENV=production npm run check:prod
  3. ADMIN_EMAIL=... ADMIN_PASSWORD='...' npm run seed:admin
  4. pm2 start ecosystem.config.js && pm2 save
  5. sudo certbot --nginx -d $DOMAIN --redirect -m <your email> --agree-tos
  6. curl https://$DOMAIN/health

After that, every push to main deploys through GitHub Actions (docs/DEPLOY.md, step 10).
EOF
