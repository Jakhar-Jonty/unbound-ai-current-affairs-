# Unbound AI – Current Affairs (backend, pipeline, admin)

Backend for a current affairs app for UPSC aspirants. An AI pipeline turns news feeds into exam explainers and MCQs. Editors check each item against its sources before it goes live. Every user then reads the same published library, while quiz attempts, bookmarks and progress are stored per user.

This repository holds the **API**, the **automated content pipeline**, the **admin panel** and the **mobile app** (`mobile/`, Expo / React Native; see [mobile/README.md](mobile/README.md)).

Brand palette, used in both the app and the admin panel: `#151515` black, `#F5F2EC` ivory, `#777777` grey, `#FF7928` orange.

## How it works

```
 News feeds (RSS/Atom)                                   Mobile app (React Native)
        │                                                        │
        ▼                                                        ▼
 ┌──────────────┐  ingest-feeds   ┌────────────┐          ┌──────────────┐
 │ Worker       │ ───────────────▶│  RawItem   │          │  API (Express)│
 │ (node-cron)  │  generate-      │  queue     │          │  /api/v1      │
 │              │  content ──────▶│            │──AI────▶ │               │
 │              │                 └────────────┘ Claude / │               │
 │              │                       │        OpenAI / │               │
 │              │                       ▼        Gemini   │               │
 │              │              Article + Questions        │               │
 │              │              status: in_review          │               │
 │              │                       │                 │               │
 │              │        Editor checks flagged facts      │               │
 │              │        in the admin panel → publish     │               │
 │              │                       │                 │               │
 │              │  daily-quiz ─────▶ Daily quiz + push ──▶│               │
 └──────────────┘                                          └──────────────┘
                          MongoDB (single source of truth)
```

**Content lifecycle:** `draft → in_review → published → (corrected vN) → retracted`, or `in_review → rejected`.

### Safeguards for accuracy

AI-generated content is the main risk in a current affairs product, so the pipeline is built around checking it:

- **Nothing is published automatically.** Generated articles and questions go to the review queue.
- **Flagged facts.** The model must list every checkable claim it made, such as figures, dates, names and legal provisions. An editor cannot publish until they have ticked each one against the source. The server enforces this; it isn't just a UI rule.
- **Source tracking.** Each article keeps the source URL, publisher, timestamp and the excerpt the model read. It also stores the provider, model, prompt version and raw AI output.
- **Validation.** Every provider's output is checked against one strict schema: exactly 4 distinct options, a valid answer index, known subjects, and so on. Invalid output is retried and never stored.
- **Corrections, not silent edits.** Editing published content requires a correction note. It bumps the version, stores an immutable revision snapshot and shows the note to readers.
- **Retraction.** A retracted article stays reachable with a notice explaining why. Its questions leave every quiz.
- **Past scores stay fixed.** Quiz attempts store the answer key and question version at the time of the attempt. A later answer-key fix is flagged on the result screen but doesn't change the past score.
- **Audit log.** Every editorial and admin action is recorded with who did it and when.

### Story grouping

Several outlets usually report the same event. The pipeline groups them so editors review each story once, and the explainer draws on every report:

1. **When news is collected**, each new item is compared with items from the last 72 hours (`src/modules/pipeline/similarity.js`). It uses word-overlap scoring (TF-IDF cosine) on headline and summary and runs locally, so it costs nothing and works with any AI provider. Close matches share a `storyKey`.
2. **When articles are written**, all queued items in a story are sent to the AI together (up to 4, official sources such as PIB, ministries, RBI and courts first). The prompt tells the model to prefer official sources and to flag any disagreement between outlets as a fact to verify.
3. **Coverage arriving later** is added as an extra source (marked "added later") while the article is still in review. Published, retracted and rejected stories are never changed or brought back by the pipeline.
4. **Missed duplicates.** The threshold is deliberately conservative, because blending two different stories is worse than missing a duplicate. Each article in review shows "Possible duplicates" in the admin panel; merging moves sources, flagged facts and questions into the other article, resets fact confirmations, and rejects the duplicate with a link to where it went.

### Free and Premium

| | Free | Premium (₹49/month or ₹499/year) |
|---|---|---|
| Daily articles and quizzes | Last 30 days | Full archive |
| Weekly leaderboard | ✓ | ✓ |
| Practice by subject | 10 questions a day | Unlimited |
| Saved articles and questions | 20 | Unlimited |
| Offline reading | – | ✓ |
| Weak-topic insights | – | ✓ |
| AI tutor, audio briefings | – | When they launch |

- Limits are enforced on the server (`src/modules/billing/entitlements.js`) and set in `.env`. Limited endpoints return `403` with `error.code = "premium_required"` and `details.feature`, and the app shows an upgrade prompt.
- **`PREMIUM_ENABLED=false` (the default) unlocks everything for everyone.** Turn it on once payments work.
- Admins can give complimentary Premium from the admin panel's **Users** tab.

**Payments (Razorpay subscriptions).** People pay on a web checkout page (`/premium`) using UPI, card or net banking:
1. The app asks for a 15-minute sign-in link (`POST /billing/checkout-link`). The token travels in the URL fragment, so it never reaches server logs, and it only works for `/billing` endpoints.
2. The page creates a Razorpay subscription and opens Razorpay Checkout.
3. After payment, `POST /billing/verify` checks Razorpay's signature (HMAC of `payment_id|subscription_id`) and grants access for the paid period.
4. Webhooks (`POST /billing/webhook`, signature-checked, each event handled once) keep access in sync with renewals, cancellations and failed payments. A *halted* subscription (renewals failing) ends access immediately; a *cancelled* one keeps access until the paid period ends.
5. Deleting an account cancels its subscription straight away.

**Store rules.** Apple doesn't allow digital subscriptions sold outside in-app purchase, or links to them, so the iOS app never shows a buy button. Google Play has the same rule unless you're enrolled in its *user choice billing* programme (India), so the Android buy button stays off until you set `PREMIUM_PURCHASE_ANDROID=true`. The web page works for anyone, any time.

**Setting up Razorpay**
1. Put the API keys (test mode first) in `.env`: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`.
2. Run `npm run razorpay:plans` and copy the two plan IDs it prints into `.env`.
3. In the Razorpay dashboard, add a webhook to `https://<your server>/api/v1/billing/webhook` for the `subscription.*` events (`activated`, `charged`, `pending`, `halted`, `cancelled`, `completed`, `paused`, `resumed`), and put its secret in `RAZORPAY_WEBHOOK_SECRET`.
4. Set `PUBLIC_URL` and `PREMIUM_ENABLED=true`.

### Sign-in

- **Email and password.** Accounts get a 6-digit verification code by email on sign-up (shared code system with password reset: hashed, 15 minutes, single use, 5 tries). A verified email is needed before buying Premium, because receipts go there.
- **Google and Apple.** The app sends the provider's ID token; the server checks its signature against Google's or Apple's public keys, plus the issuer and audience (`GOOGLE_CLIENT_IDS`, `APPLE_CLIENT_IDS`). A provider-verified email that matches an existing account is linked to it. Google/Apple-only accounts can set a password later, and confirm account deletion by typing DELETE.

### Reliable background jobs

- The worker runs as a **separate process** from the API, so long AI batches don't slow down requests.
- Each job runs under a **MongoDB lock**, so the same job can't run twice at once, even with several workers. Locks expire on their own, so a crash can't block a job forever.
- **Every job is safe to re-run:** duplicate feed URLs are ignored, items are claimed atomically, items stuck after a crash go back to the queue, and there is one daily quiz per date with one notification.
- Every run is stored in `jobruns` with status, duration, stats and error. Failed runs show in the admin panel.
- Failed items are retried up to `PIPELINE_MAX_ATTEMPTS` times, then marked `failed`. An admin can retry them from the panel.

## Project layout

```
src/
  app.js, server.js          Express app and API entry point
  worker.js                  Scheduled pipeline (separate process)
  config.js                  All configuration, from environment variables
  lib/                       db, logger, errors, validation, helpers
  modules/
    users/                   accounts, JWT auth, roles (user / editor / admin)
    taxonomy/                UPSC GS papers and subjects
    content/                 articles, revisions, public content API
    quiz/                    questions, quizzes, attempts, progress, daily quiz
    bookmarks/               user bookmarks (articles and questions)
    notifications/           device tokens, Expo push
    admin/                   review workflow, corrections, audit log, admin API
    pipeline/                feed ingestion, AI generation, prompts and schema
      ai/                    claude.js, openai.js, gemini.js, mock.js
    jobs/                    job runner, locks, run log, job registry
public/admin/                Admin panel (plain HTML/JS, served at /admin)
scripts/                     create-admin, run a job once
test/                        Integration tests (node:test + real MongoDB)
mobile/                      React Native app (Expo)
```

## Running locally

Requirements: Node.js 20+ and MongoDB 7 (or Docker).

```bash
npm install
cp .env.example .env            # AI_PROVIDER=mock needs no API key
docker compose up -d mongo      # or point MONGODB_URI at your own MongoDB

ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-long-password' npm run seed:admin
npm run seed:demo               # optional: 5 published explainers, a quiz and a test user (no AI calls)

npm run dev                     # API on http://localhost:4000, admin panel at /admin
npm run worker                  # scheduled pipeline (in another terminal)

# Or run single jobs by hand:
npm run job -- ingest-feeds
npm run job -- generate-content
npm run job -- daily-quiz
```

`seed:demo` loads hand-written explainers on settled topics (MPC, GST Council, Fundamental Duties, right to privacy, Ramsar), published through the normal approval rules, plus a topic quiz and a verified test user, `student@example.com`. The password is printed once; set `DEMO_PASSWORD` to choose it. Running it again adds nothing. `npm run seed:demo -- --reset` removes it all, and keeps any quiz that also holds real questions. It refuses to run with `NODE_ENV=production`.

Tests use a real MongoDB, with a separate throwaway database per test file:

```bash
npm test                        # uses mongodb://127.0.0.1:27017 (override with MONGODB_URI_TEST)
```

## Choosing the AI provider

Set `AI_PROVIDER` and the matching API key. All four providers share one interface: `generateJSON({ system, prompt, schema })`. Each requests schema-constrained JSON output, and the result is validated by the same zod schema whichever provider produced it.

| `AI_PROVIDER` | Key | Default model (override with `AI_MODEL`) | Notes |
|---|---|---|---|
| `claude` | `ANTHROPIC_API_KEY` | `claude-opus-5-5` | Adaptive thinking, `AI_EFFORT` (default `high`), server-side refusal fallback enabled |
| `openai` | `OPENAI_API_KEY` | `gpt-5-mini` | Strict JSON schema output |
| `gemini` | `GEMINI_API_KEY` | `gemini-2.5-flash` | JSON response schema |
| `mock` | – | – | Offline, deterministic output for development and tests |

Check the OpenAI and Gemini default model names against each provider's current model list before production, and set `AI_MODEL` if needed. To add another provider, add one file in `src/modules/pipeline/ai/` and register it in `index.js`.

The prompt is in `src/modules/pipeline/prompts.js`. Bump `PROMPT_VERSION` whenever you change it; every article records the version it was generated with.

## API reference (v1)

All endpoints are under `/api/v1`. Authenticated endpoints take `Authorization: Bearer <token>`. Errors look like `{ "error": { "code", "message", "details?" } }`. List endpoints take `?page=&limit=` (maximum 50).

**Public and account**

| Method | Path | Description |
|---|---|---|
| GET | `/meta` | `minAppVersion`, `latestAppVersion` for update prompts |
| POST | `/auth/register` | `{ email, name, password }` → `{ user, token }` |
| POST | `/auth/login` | `{ email, password }` → `{ user, token }` |
| GET | `/auth/me` | Current user |
| POST | `/auth/google` | `{ idToken }` → `{ user, token }` |
| POST | `/auth/apple` | `{ identityToken, fullName? }` → `{ user, token }` |
| POST | `/auth/email/send` · `/auth/email/verify` | Send a verification code / verify with `{ code }` |
| POST | `/auth/password/forgot` | `{ email }` → always 202; emails a 6-digit code (15 min, single use, 5 tries) |
| POST | `/auth/password/reset` | `{ email, code, password }` → `{ user, token }`; signs out other sessions |
| POST | `/auth/password/change` | `{ currentPassword, newPassword }` → `{ user, token }`; signs out other sessions |
| PATCH | `/auth/me` | `{ name?, showOnLeaderboard?, preferredSubjects? }` |
| DELETE | `/auth/me` | `{ password }` permanently deletes the account and personal data |
| GET | `/taxonomy` | GS papers and subjects |
| GET | `/articles` | Published articles with `readingMinutes`; filters `subject` or `subjects` (comma-separated), `gsPaper`, `q` (text search), `from`, `to` |
| GET | `/articles/:id/related` | Up to 4 recent articles on the same subjects, most similar first |
| GET | `/articles/:idOrSlug` | Article detail with sources, corrections and any retraction notice |
| GET | `/quizzes` | Published quizzes (`?type=daily`) |
| GET | `/quizzes/today` | Today's daily quiz (IST), without answers; `myAttempt` if signed in |
| GET | `/quizzes/:id` | A quiz, without answers |
| POST | `/quizzes/:id/check` | Guests: grade answers without saving (same result shape, `id: null`); rate-limited per IP |
| POST | `/quizzes/:id/attempts` | `{ answers: [{ questionId, selectedIndex \| null, timeMs? }], durationMs? }` → result with explanations. One attempt per quiz |
| GET | `/attempts/:id` | Your result, with explanations and any corrections made since |
| GET | `/me/attempts` | Your attempt history |
| GET | `/me/progress` | Accuracy overall and per subject (quizzes + practice), practice totals, daily streak (quiz or practice) |
| GET/POST | `/me/bookmarks` | List, or add `{ itemType: article\|question, itemId, note? }` |
| GET | `/me/bookmarks/status` | `?itemType=article&ids=a,b` → `{ bookmarks: { [itemId]: bookmarkId } }` |
| DELETE | `/me/bookmarks/:id` | Remove a bookmark |
| GET | `/leaderboard/weekly` | Daily-quiz correct answers this week (Mon–Sun IST): top 50 as "First L.", plus `me` |
| GET | `/practice/subjects` | Published question count per subject |
| GET | `/practice/questions` | `?subject=&count=10`: random set, favouring questions not yet answered correctly. Works without an account |
| POST | `/practice/answers` | `{ questionId, selectedIndex }` → correct answer and explanation immediately. Guests: not stored, free daily allowance per IP |
| GET | `/me/insights` | Premium: weak subjects, trends, accuracy by GS paper, questions to revisit (last 90 days) |
| GET | `/billing/plans` | Plans, prices, free limits, where purchase is available |
| GET | `/billing/status` | Your premium status, limits and subscription |
| POST | `/billing/checkout-link` | 15-minute signed-in link to the web checkout |
| POST | `/billing/subscriptions` · `/billing/verify` · `/billing/cancel` | Used by the checkout page |
| POST | `/billing/webhook` | Razorpay webhooks (signature-checked) |
| POST | `/me/devices` | Register an Expo push token `{ token, platform, appVersion? }` |
| DELETE | `/me/devices` | Unregister `{ token }` (call on sign-out) |

**Admin** (`/admin/*`, role `editor` or above; routes marked ★ need `admin`)

| Method | Path | Description |
|---|---|---|
| GET | `/admin/dashboard` | Counts by status, last run of each job |
| GET | `/admin/articles` | All articles, `?status=in_review` |
| GET | `/admin/articles/:id` | Full detail with questions, revisions, history and raw AI output |
| GET | `/admin/articles/:id/similar` | Up to 5 recent articles that look like the same event |
| POST | `/admin/articles/:id/merge` | `{ intoId }` merges this article (in review) into another one in review |
| POST | `/admin/articles` | Write an article by hand (goes to review) |
| PATCH | `/admin/articles/:id` | Edit; published articles need `correctionNote` |
| POST | `/admin/articles/:id/approve` | `{ confirmedFacts: [indexes], notes? }` publishes the article and its questions |
| POST | `/admin/articles/:id/reject` | `{ reason }` |
| POST | `/admin/articles/:id/retract` | `{ reason }` |
| POST | `/admin/articles/:id/questions` | Add a question |
| PATCH | `/admin/questions/:id` | Edit; published questions need `correctionNote` |
| POST | `/admin/questions/:id/reject` · `/restore` | Reject or restore a question |
| GET/POST | `/admin/quizzes` | List, or create a topic/custom quiz from published questions |
| POST | `/admin/quizzes/:id/publish` | Publish a draft quiz |
| GET | `/admin/raw-items` | Pipeline queue, `?status=failed` |
| POST | `/admin/raw-items/:id/retry` ★ | Re-queue a failed or skipped item |
| GET | `/admin/jobs/runs` | Job run history |
| POST | `/admin/jobs/:name/run` ★ | Run a job now (`?wait=true` to wait for the result) |
| POST | `/admin/notifications` ★ | Send a push notification to all devices |
| GET/PATCH | `/admin/users[/:id]` ★ | List/search users; change role, disable, or give complimentary Premium (`premiumUntil`) |
| GET | `/admin/audit` | Audit log |

## Deploying to a single Linux VPS

Step-by-step commands for Ubuntu (server hardening, Node, pm2, nginx, HTTPS, updates) are in [docs/DEPLOY.md](docs/DEPLOY.md). In short:

1. **MongoDB.** MongoDB Atlas is the simplest choice: it handles backups and failover. If you self-host, enable auth, bind to `127.0.0.1` and **never expose port 27017**. Set up daily off-site backups (`mongodump --gzip --archive` to object storage) and **test a restore**.
2. **App:** `npm ci --omit=dev`, fill in `.env` (a strong `JWT_SECRET`, an AI key, `SMTP_URL` for password-reset emails), then `npm run seed:admin`.
3. **Processes:** `pm2 start ecosystem.config.js && pm2 save && pm2 startup`. This runs `ca-api` and `ca-worker` separately.
4. **nginx** in front with TLS (Let's Encrypt), proxying to `127.0.0.1:4000`. Published-content endpoints send `Cache-Control: public`, so a CDN or nginx cache can serve most reads.
5. **Monitoring:** an uptime check on `/health`, and an alert when a job run fails (they show in the admin panel's Pipeline tab).

### Scaling later

The plan's next step is "background workers + Redis". Jobs already sit behind `runJob(job)` and a registry, so moving to BullMQ means replacing `src/modules/jobs/runner.js` and `worker.js`. Routes and pipeline code don't change. The API is stateless (JWT), so you can run more API instances behind nginx at any time.

## Not in this release

- **Provider batch APIs.** The pipeline processes items in small concurrent batches. Moving overnight runs to a provider's batch API (about 50% cheaper on Claude and OpenAI) is a possible cost optimisation.
- From the later releases in the plan: AI tutor, audio briefings, leaderboards and study plans. Per-question, per-subject attempt data is already being recorded, so study plans and leaderboards can use history from day one.
