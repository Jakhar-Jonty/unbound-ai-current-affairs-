# Launch checklist: Unbound Daily on Google Play

App: **Unbound Daily** · package `com.unbound.daily` (permanent: can't be changed after the first upload) · server `https://unbounddaily.zonty.in`.

Files in this folder:

- [listing.md](listing.md): store title, descriptions (English and Hindi) and graphics sizes
- [data-safety.md](data-safety.md): Data safety, content rating, audience and other declarations
- [review-notes.md](review-notes.md): what to tell the reviewer, test account

## 1. Server live

Follow [../DEPLOY.md](../DEPLOY.md). Done when:

- [ ] DNS: an **A record** for `unbounddaily` in the `zonty.in` zone points at the VPS IP
- [ ] `https://unbounddaily.zonty.in/health` returns `{"status":"ok"}`
- [ ] Legal settings in `.env` (`LEGAL_OPERATOR`, `LEGAL_CONTACT_EMAIL`, `GRIEVANCE_OFFICER`, `LEGAL_ADDRESS`, `LEGAL_CITY`) and `NODE_ENV=production npm run check:prod` passes
- [ ] `/privacy`, `/terms`, `/refunds`, `/contact` and `/delete-account` read correctly, in English and with `?lang=hi`
- [ ] A sign-up email with the verification code arrives (SMTP works)
- [ ] Articles are generating and at least a week of content is approved, so the app isn't empty on day one

## 2. App ready

- [ ] Real logo in `mobile/assets/` (icon, Android adaptive icon layers, splash, favicon)
- [ ] Expo account: `cd mobile && npx eas-cli login && npx eas-cli init` (adds `extra.eas.projectId` to `app.json`; needed for push)
- [ ] Push and Google sign-in: follow [../GOOGLE.md](../GOOGLE.md) (Firebase project, `google-services.json`, FCM key, OAuth clients). Add the Play signing SHA-1 after the first upload
- [ ] Test build on a real phone: `npx eas-cli build -p android --profile preview` (installable APK pointing at production)
- [ ] Production build: `npx eas-cli build -p android --profile production` (AAB; the version code increases automatically)

## 3. Play Console

- [ ] Developer account (one-time US$25). Personal accounts need identity verification
- [ ] Create app: name "Unbound Daily: Current Affairs", default language English (India), App, Free
- [ ] Store listing and Hindi translation from [listing.md](listing.md); screenshots and feature graphic
- [ ] App content: privacy policy URL, app access, ads, content rating, target audience, data safety, news declaration, data deletion URL (all in [data-safety.md](data-safety.md))
- [ ] Countries: India (add others later if you want)
- [ ] Upload the AAB to **Internal testing** first and install it from the Play link

**New personal developer accounts must run a closed test before production:** at least 12 testers opted in for 14 days in a row. Start this as early as possible: create a **Closed testing** track, add testers by email list or Google Group, share the opt-in link, and keep them installed for the full 14 days. Then apply for production access in the Dashboard. (Organisation accounts, which need a D-U-N-S number, skip this.)

Upload automatically once a service account exists: put the JSON key at `mobile/play-service-account.json` (git-ignored) and run `npx eas-cli submit -p android --profile production`. It uploads to the internal track as a draft. The very first upload must be done by hand in Play Console.

## 4. Launch day

- [ ] Production release with release notes (English and Hindi)
- [ ] After it's live: set `STORE_URL` on the server (website home page link) and `extra.storeUrl` in `app.json` (update prompt), and `LATEST_APP_VERSION`
- [ ] Uptime check on `/health`, daily database backups (see DEPLOY.md)

## Later: iOS

Needs an Apple Developer account (US$99/year). Bundle ID `com.unbound.daily` is already set, and Sign in with Apple is wired up. App Store rules mean Premium can't be bought inside the iOS app (already handled: iOS shows a note instead).

## Still needed from you

| Item | Used for |
|---|---|
| Logo (square, works small) | App icon, splash, store icon, feature graphic |
| Name or business name to show as operator | Privacy policy, terms, contact page, Play listing |
| Support email at your domain, e.g. `support@zonty.in` | Contact, privacy requests, grievance officer, store listing |
| Grievance officer name (can be you) | Required by Indian IT Rules / DPDP Act |
| Postal address and city for disputes | Contact page (Razorpay checks it), terms |
| VPS + DNS A record | Hosting |
| SMTP provider | Codes by email |
| 12 testers for 14 days | Play closed-testing requirement |
| Refund rules (defaults written in `/refunds`) | Confirm or change before turning Premium on |
