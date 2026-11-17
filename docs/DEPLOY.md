# Deploying the backend to a VPS

This puts the API, admin panel, checkout page and pipeline worker on one Linux server, behind nginx with HTTPS. Steps assume **Ubuntu 24.04** and take about an hour the first time.

You end up with:

```
Internet ──HTTPS──▶ nginx (:443) ──▶ ca-api (:4000, pm2)      ─┐
                                     ca-worker (pm2, cron jobs) ─┴──▶ MongoDB Atlas
```

## 0. Before you start

- **A VPS.** 1 vCPU and 1–2 GB RAM is enough to start (DigitalOcean, Hetzner, Lightsail, Linode and so on). Pick a region close to India, such as Mumbai, Bangalore or Singapore.
- **A domain or subdomain** for the API, e.g. `api.yourdomain.com`, with an **A record** pointing at the VPS IP. Certbot needs this to issue the HTTPS certificate, and the mobile app needs HTTPS.
- **A production database, separate from development.** In Atlas, either create a new cluster or use a new database name in the connection string (`.../unbound_prod?...`). Under **Network Access**, add the VPS IP; don't leave `0.0.0.0/0` open.
- **Email (SMTP).** Without it, sign-up verification and password-reset codes are not sent. Any provider works, for example:
  - Gmail with an [app password](https://myaccount.google.com/apppasswords): `smtps://you%40gmail.com:APP_PASSWORD@smtp.gmail.com:465`
  - Brevo, Resend, Mailgun or Amazon SES (better deliverability once you have real users)

## 1. Secure the server

From your computer, log in as root once:

```bash
ssh root@YOUR_SERVER_IP
```

Create a normal user, copy your SSH key to it, and turn on the firewall:

```bash
adduser deploy
usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy

ufw allow OpenSSH
ufw allow 'Nginx Full'   # run after installing nginx in step 2 if this errors
ufw enable
```

Open a **new** terminal and check you can log in as `deploy` with `ssh deploy@YOUR_SERVER_IP` before going on. Then turn off root and password logins: in `/etc/ssh/sshd_config` set `PermitRootLogin no` and `PasswordAuthentication no`, and run `sudo systemctl restart ssh`.

Port 4000 stays closed to the internet; only nginx talks to the app.

## 2. Install Node.js 22, nginx, certbot and pm2

As `deploy`:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git nginx certbot python3-certbot-nginx

curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node -v   # v22.x

sudo npm install -g pm2
```

## 3. Get the code

```bash
sudo mkdir -p /srv/unbound && sudo chown deploy:deploy /srv/unbound
git clone https://github.com/Jakhar-Jonty/unbound-ai-current-affairs-.git /srv/unbound
cd /srv/unbound
npm ci --omit=dev
```

If the repository is private, add a [deploy key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys) to it and clone with the `git@github.com:...` URL instead.

## 4. Production settings (`.env`)

```bash
cp .env.example .env
nano .env
chmod 600 .env
```

Set at least these. Generate the secret on the server with `openssl rand -hex 32`, and never reuse your development values.

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` (pm2 sets it too) |
| `MONGODB_URI` | Production connection string from step 0 |
| `JWT_SECRET` | 64 hex characters from `openssl rand -hex 32`. The API refuses to start with fewer than 32 |
| `PUBLIC_URL` | `https://api.yourdomain.com` |
| `CORS_ORIGINS` | Leave empty (the mobile app doesn't need CORS). Add an origin only if you host the web app |
| `SMTP_URL`, `MAIL_FROM` | From step 0, e.g. `MAIL_FROM="Unbound <no-reply@yourdomain.com>"` |
| `AI_PROVIDER` + its key | e.g. `gemini` and `GEMINI_API_KEY` |
| `PIPELINE_CONCURRENCY`, `PIPELINE_BATCH_SIZE` | `1` and `4` on Gemini's free tier |
| `PREMIUM_ENABLED` | `false` until Razorpay is set up |
| `PUSH_ENABLED` | `false` until the app has an EAS project ID |

**Gemini free tier:** it allows about 20 requests a day. The default schedule generates every 2 hours, so most runs will hit the limit; that's handled (stories wait for the next run without losing attempts), but you'll get roughly 20 articles a day at most. Billing on the key removes the limit.

## 5. Create the admin account

```bash
ADMIN_EMAIL=you@yourdomain.com ADMIN_PASSWORD='a-long-unique-password' npm run seed:admin
```

Use a long, unique password: this account can publish to every user. Don't run `seed:demo` on production; it refuses anyway.

## 6. Start the API and worker

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup        # prints a sudo command: run it, so both restart after a reboot
pm2 install pm2-logrotate

curl http://127.0.0.1:4000/health   # {"status":"ok","db":"up"}
```

`pm2 status` should show `ca-api` and `ca-worker` online. Logs: `pm2 logs ca-api` and `pm2 logs ca-worker`.

## 7. nginx and HTTPS

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/unbound
sudo sed -i 's/api.example.com/api.yourdomain.com/' /etc/nginx/sites-available/unbound
sudo ln -s /etc/nginx/sites-available/unbound /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

sudo certbot --nginx -d api.yourdomain.com --redirect -m you@yourdomain.com --agree-tos
```

Certbot renews the certificate automatically.

## 8. Check it works

From your computer:

```bash
curl https://api.yourdomain.com/health
curl https://api.yourdomain.com/api/v1/meta
```

Then:

1. Sign in at `https://api.yourdomain.com/admin`.
2. Fill the queue now instead of waiting for the schedule:
   ```bash
   cd /srv/unbound
   npm run job -- ingest-feeds
   npm run job -- generate-content
   ```
3. Approve a few articles in the admin panel, then `npm run job -- daily-quiz`.
4. Register in the app with a real email and check the verification code arrives.

## 9. Point the mobile app at it

For testing with Expo Go:

```bash
cd mobile
EXPO_PUBLIC_API_URL=https://api.yourdomain.com npx expo start
```

For store builds, set `extra.apiUrl` in `mobile/app.json` (or `EXPO_PUBLIC_API_URL` in the EAS build profile) to the same URL.

## 10. Updating

After merging to `main` on GitHub, on the server:

```bash
cd /srv/unbound && ./scripts/deploy.sh
```

It pulls `main`, installs dependencies, reloads both processes and checks `/health`.

## 11. Keep it healthy

- **Backups.** Atlas has backups on paid clusters; the free M0 tier does not. On M0, run a daily `mongodump --uri="$MONGODB_URI" --gzip --archive=backup-$(date +%F).gz` and copy it off the server. Test a restore once.
- **Uptime.** Add a free uptime check (UptimeRobot, Better Stack) on `https://api.yourdomain.com/health`.
- **Failed jobs** show in the admin panel's Pipeline tab.
- **Security updates:** `sudo apt install unattended-upgrades`.

## Troubleshooting

| Symptom | Check |
|---|---|
| `JWT_SECRET must be set to at least 32 characters` | `.env` secret too short, or `.env` not found (`pm2 describe ca-api`, check `cwd`) |
| `/health` says `"db":"down"` | Atlas Network Access doesn't include the VPS IP, or the URI is wrong |
| `502 Bad Gateway` | API not running: `pm2 status`, `pm2 logs ca-api` |
| Certbot fails | DNS A record not pointing at the server yet (`dig api.yourdomain.com`), or port 80 blocked |
| No verification emails | `SMTP_URL` missing or wrong; look for `email not sent` in `pm2 logs ca-api` |
| App can't reach the API | URL must be `https://`; on a phone, `localhost` is the phone |
