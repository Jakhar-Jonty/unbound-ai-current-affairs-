# Deploying the backend to a VPS

This puts the API, admin panel, checkout page and pipeline worker on one Linux server, behind nginx with HTTPS. Steps assume **Ubuntu 24.04** and take about an hour the first time.

You end up with:

```
Internet ──HTTPS──▶ nginx (:443) ──▶ ca-api (:4000, pm2)      ─┐
                                     ca-worker (pm2, cron jobs) ─┴──▶ MongoDB Atlas
```

## 0. Before you start

- **A VPS.** 1 vCPU and 1–2 GB RAM is enough to start (DigitalOcean, Hetzner, Lightsail, Linode and so on). Pick a region close to India, such as Mumbai, Bangalore or Singapore.
- **A domain or subdomain** for the API, e.g. `unbounddaily.zonty.in`, with an **A record** pointing at the VPS IP. Certbot needs this to issue the HTTPS certificate, and the mobile app needs HTTPS.
- **A production database, separate from development.** In Atlas, either create a new cluster or use a new database name in the connection string (`.../unbound_prod?...`). Under **Network Access**, add the VPS IP; don't leave `0.0.0.0/0` open.
- **Email (SMTP).** Without it, sign-up verification and password-reset codes are not sent. Any provider works, for example:
  - Gmail with an [app password](https://myaccount.google.com/apppasswords): `smtps://you%40gmail.com:APP_PASSWORD@smtp.gmail.com:465`
  - Brevo, Resend, Mailgun or Amazon SES (better deliverability once you have real users)

## 1. Make the deploy key (on your computer)

GitHub Actions logs in to the server with its own SSH key, which can only run the deploy script.

```bash
ssh-keygen -t ed25519 -N "" -C github-actions -f ~/.ssh/unbound_deploy
cat ~/.ssh/unbound_deploy.pub     # the public half, used in step 2
```

Also make sure the VPS was created with **your own SSH key** (most providers ask for it). You need it to log in once root login is turned off.

## 2. Run the setup script (once, as root)

```bash
scp deploy/setup-vps.sh root@YOUR_SERVER_IP:
ssh root@YOUR_SERVER_IP
CI_DEPLOY_KEY='ssh-ed25519 AAAA... github-actions' bash setup-vps.sh   # paste the .pub line
```

It asks for a password for the `deploy` user (used for `sudo`), then:

- updates the system and turns on automatic security updates, the firewall (SSH, HTTP, HTTPS only) and fail2ban;
- installs Node.js 22, pm2, nginx, certbot and `mongodump`, and adds 2 GB swap if there is none;
- creates the `deploy` user with your key, plus the Actions key locked to `scripts/deploy.sh`;
- clones the code to `/srv/unbound` and installs dependencies;
- sets pm2 to start on boot with 30-day log rotation, and installs the nginx site for `unbounddaily.zonty.in`;
- schedules a daily database backup at 03:30 to `/srv/backups`, keeping 30 days;
- turns off root and password logins (only if `deploy` has your key).

It's safe to run again, e.g. to add the Actions key later. Before you close the root session, check in a **new** terminal that `ssh deploy@YOUR_SERVER_IP` works.

Port 4000 stays closed to the internet; only nginx talks to the app.

## 3. DNS

Add an **A record** `unbounddaily` → the server IP in the `zonty.in` DNS zone. Wait until `dig +short unbounddaily.zonty.in` prints the IP.

## 4. Production settings (`.env`)

From here on, log in as `deploy` (`ssh deploy@YOUR_SERVER_IP`).

```bash
cd /srv/unbound
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
| `PUBLIC_URL` | `https://unbounddaily.zonty.in` |
| `CORS_ORIGINS` | Leave empty (the mobile app doesn't need CORS). Add an origin only if you host the web app |
| `SMTP_URL`, `MAIL_FROM` | From step 0, e.g. `MAIL_FROM="Unbound Daily <no-reply@zonty.in>"` |
| `AI_PROVIDER` + its key | e.g. `gemini` and `GEMINI_API_KEY` |
| `PIPELINE_CONCURRENCY`, `PIPELINE_BATCH_SIZE` | `1` and `4` on Gemini's free tier |
| `PREMIUM_ENABLED` | `false` until Razorpay is set up |
| `PUSH_ENABLED` | `false` until the app has an EAS project ID |
| `LEGAL_OPERATOR`, `LEGAL_CONTACT_EMAIL`, `GRIEVANCE_OFFICER`, `LEGAL_ADDRESS`, `LEGAL_CITY` | Shown on `/privacy`, `/terms`, `/refunds` and `/contact`. Use a support address (e.g. `support@zonty.in`), not a personal inbox. Required by Google Play and Razorpay |

Then run the launch check. It lists anything missing and exits with an error until the must-haves are set:

```bash
NODE_ENV=production npm run check:prod
```

**Gemini free tier:** it allows about 20 requests a day. The default schedule generates every 2 hours, so most runs will hit the limit; that's handled (stories wait for the next run without losing attempts), but you'll get roughly 20 articles a day at most. Billing on the key removes the limit.

## 5. Create the admin account

```bash
ADMIN_EMAIL=you@zonty.in ADMIN_PASSWORD='a-long-unique-password' npm run seed:admin
```

Use a long, unique password: this account can publish to every user. Don't run `seed:demo` on production; it refuses anyway.

## 6. Start the API and worker

```bash
cd /srv/unbound
pm2 start ecosystem.config.js
pm2 save                                # restored on reboot
curl http://127.0.0.1:4000/health      # {"status":"ok","db":"up"}
```

`pm2 status` should show `ca-api` and `ca-worker` online. Logs: `pm2 logs ca-api` and `pm2 logs ca-worker`.

## 7. HTTPS

The setup script already installed the nginx site. Once DNS points at the server:

```bash
sudo certbot --nginx -d unbounddaily.zonty.in --redirect -m you@zonty.in --agree-tos
```

Certbot renews the certificate automatically.

## 8. Check it works

From your computer:

```bash
curl https://unbounddaily.zonty.in/health
curl https://unbounddaily.zonty.in/api/v1/meta
```

Then:

1. Sign in at `https://unbounddaily.zonty.in/admin`.
2. Fill the queue now instead of waiting for the schedule:
   ```bash
   cd /srv/unbound
   npm run job -- ingest-feeds
   npm run job -- generate-content
   ```
3. Approve a few articles in the admin panel, then `npm run job -- daily-quiz`.
4. Register in the app with a real email and check the verification code arrives.
5. Open the public pages and read them once: `https://unbounddaily.zonty.in/privacy`, `/terms`, `/refunds`, `/contact`, `/delete-account` (add `?lang=hi` for Hindi). Nothing should be highlighted as "not set".
6. Try the web deletion on a throwaway account: `/delete-account` → code by email → account gone.

## 9. Point the mobile app at it

For testing with Expo Go:

```bash
cd mobile
EXPO_PUBLIC_API_URL=https://unbounddaily.zonty.in npx expo start
```

For store builds, set `extra.apiUrl` in `mobile/app.json` (or `EXPO_PUBLIC_API_URL` in the EAS build profile) to the same URL.

## 10. Automatic deploys (GitHub Actions)

`.github/workflows/backend.yml` runs the tests on every pull request. When something is merged to `main` and the tests pass, it logs in as `deploy` and runs `scripts/deploy.sh`: pull `main`, `npm ci`, reload both processes, check `/health`. Changes only under `mobile/` or docs don't deploy. `.github/workflows/mobile.yml` lints the app on pull requests that touch `mobile/`.

Set it up once in GitHub → the repository → **Settings**:

1. **Environments → New environment** named `production`. Optionally add yourself under *Required reviewers* to approve each deploy, and limit it to the `main` branch.
2. In that environment, add three **secrets**:

   | Secret | Value |
   |---|---|
   | `VPS_HOST` | The server IP |
   | `VPS_SSH_KEY` | The whole private key: `cat ~/.ssh/unbound_deploy` |
   | `VPS_KNOWN_HOSTS` | Output of `ssh-keyscan -t ed25519 YOUR_SERVER_IP` (pins the server's identity) |

3. **Actions → Backend → Run workflow** on `main` to test the first deploy.

To deploy by hand instead: `cd /srv/unbound && ./scripts/deploy.sh` as `deploy`.

**Roll back:** revert the bad commit on GitHub (a revert PR, merged); the workflow deploys the reverted code. In an emergency on the server: `git checkout <good-sha> && npm ci --omit=dev && pm2 reload ecosystem.config.js`, then fix `main` (the next deploy returns to `main`).

**Changes to `deploy/nginx.conf`** aren't applied automatically: run the setup script again, or copy the file to `/etc/nginx/sites-available/unbound` and `sudo nginx -t && sudo systemctl reload nginx`.

## 11. Keep it healthy

- **Backups.** `deploy/backup.sh` runs daily at 03:30 (cron, set up in step 2) and keeps 30 days in `/srv/backups` (the privacy policy promises deleted accounts leave backups within 30 days). Run it once by hand to check: `/srv/unbound/deploy/backup.sh`. Also copy backups off the server (e.g. `rclone` to cloud storage), and test a restore once: `mongorestore --uri="<a test database URI>" --gzip --archive=/srv/backups/unbound-YYYY-MM-DD.gz`.
- **Logs.** The privacy policy says server logs are kept up to 30 days. Ubuntu's nginx logrotate keeps 14 days by default; pm2 logs are rotated by `pm2-logrotate` (step 6).
- **Uptime.** Add a free uptime check (UptimeRobot, Better Stack) on `https://unbounddaily.zonty.in/health`.
- **Failed jobs** show in the admin panel's Pipeline tab.
- **Security updates** install automatically (unattended-upgrades). Reboot now and then when `/var/run/reboot-required` exists; pm2 brings the app back.

## Troubleshooting

| Symptom | Check |
|---|---|
| `JWT_SECRET must be set to at least 32 characters` | `.env` secret too short, or `.env` not found (`pm2 describe ca-api`, check `cwd`) |
| `/health` says `"db":"down"` | Atlas Network Access doesn't include the VPS IP, or the URI is wrong |
| `502 Bad Gateway` | API not running: `pm2 status`, `pm2 logs ca-api` |
| Certbot fails | DNS A record not pointing at the server yet (`dig unbounddaily.zonty.in`), or port 80 blocked |
| No verification emails | `SMTP_URL` missing or wrong; look for `email not sent` in `pm2 logs ca-api` |
| Deploy job: `Permission denied (publickey)` | `VPS_SSH_KEY` isn't the private half of the key passed as `CI_DEPLOY_KEY`; run the setup script again with the right `.pub` |
| Deploy job: `Host key verification failed` | `VPS_KNOWN_HOSTS` is empty or from another server; redo `ssh-keyscan` |
| Deploy job: `Local changes in /srv/unbound` | Someone edited files on the server: `git status` there, then `git checkout -- .` |
| App can't reach the API | URL must be `https://`; on a phone, `localhost` is the phone |
