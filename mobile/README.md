# Unbound – mobile app

React Native app (Expo SDK 58, Expo Router, JavaScript) for the current affairs platform. It talks to the backend in the repository root (`/api/v1`).

## Features

- **Today:** the daily quiz card and the latest published explainers
- **Explore:** search and filter by UPSC subject
- **Article:** summary, key points, explainer, "why it matters for UPSC", sources, corrections and retraction notices
- **Quiz:** one question at a time, jump between questions, warning about unanswered questions, then a result screen with explanations
- **Saved:** bookmarked articles and questions (with show/hide answer). Saved articles, and the last 30 articles read, are kept on the device and open without a connection, even if the app is started offline
- **Quizzes:** today's quiz, the weekly leaderboard, practice by subject (weakest subjects first, answer and explanation after each question) and past quizzes
- **Profile:** daily streak, leaderboard visibility switch, accuracy overall and by subject, change password, delete account (required by the App Store), sign out
- **Forgot password:** emailed 6-digit code, entered in the app (no app links needed)
- Light and dark mode, push notifications (tapping one opens the quiz), and a forced-update screen driven by the backend's `MIN_APP_VERSION`

- **Premium:** plan comparison and status; on Android and web it opens the secure Razorpay web checkout. Locked content shows an upgrade prompt, and premium is refreshed when you come back from checkout.
- **Insights (Premium):** weakest subjects with one-tap practice, 8-week chart, accuracy by subject and GS paper, questions to revisit
- **Hindi:** English / हिंदी switch in the intro, Profile, and on articles and quizzes. Articles, key points, quiz questions, options and explanations come in Hindi once an editor has published the translation; otherwise English with a short note. Labels around the content (key points, sources, reading time, subject names) follow the chosen language; the rest of the app is in English.
- **Sign-in:** email and password with email verification, Google, and Apple (iOS)
- **Reading:** reading time on cards and articles, a progress bar while reading, related articles, and “Continue reading” on Today for an article you started but didn’t finish
- **For you feed:** pick your subjects (in the intro or Profile → My subjects; saved to the account when signed in) and Today shows them first
- **Quiz:** start screen with an optional exam timer (72 s a question, the Prelims pace; submits itself at zero), a review screen before submitting, and an animated score ring with a streak celebration
- **Motion:** buttons and options respond to touch, practice answers pulse (right) or shake (wrong), and questions and results slide in. All animation is skipped when the phone’s “reduce motion” setting is on
- **Polish:** first-launch intro, loading placeholders, haptic feedback, adjustable article text size (Aa), share

**Without an account** people can read everything, take the daily quiz (graded, kept on the device), practise by subject (free daily allowance), save up to 20 items on the device, use the For you feed and see the leaderboard. When they sign up or sign in, today's and yesterday's quiz results are submitted to the account (starting the streak) and device saves move to the account. Progress, Insights, the streak and leaderboard entry, and Premium need an account.

## Brand colours

Every colour is defined in `src/theme/colors.js`:

| Token | Colour | Use |
|---|---|---|
| ivory | `#F5F2EC` | Light background, dark-mode text |
| black | `#151515` | Text, dark background, inverted cards |
| grey | `#777777` | Large secondary text and icons (`#6A6A6A` / `#8F8F8F` for small text, for contrast) |
| orange | `#FF7928` | Buttons (with black text), active states, progress, highlights |
| green / red | `#2E7D4F` / `#B42318` | Quiz right/wrong only, always with a ✓ / ✗ icon |

Orange is never used as text on ivory, because the contrast (2.3:1) is too low to read.

## Running it

Expo SDK 58 needs **Node.js 22.13 or newer** (the backend works on Node 20+). With nvm: `nvm install 22 && nvm use 22`.

```bash
cd mobile
npm install
npx expo start
```

Scan the QR code with a development build or Expo Go, or press `a` for the Android emulator. In development the app finds the backend on its own: it uses the address of the computer running Metro, on port 4000, so it keeps working when your Wi-Fi (and IP) changes. Metro's log shows `[api] Using backend …` at startup. To point it somewhere else (a deployed API, or a different port), set `EXPO_PUBLIC_API_URL=https://…` (or `EXPO_PUBLIC_API_PORT`) when you start Expo. For the web version, run `npx expo start --web` and add `http://localhost:8081` to the backend's `CORS_ORIGINS`.

Other commands: `npx expo lint`, `npx expo export` (checks that the Android, iOS and web bundles compile).

## Before the first store build

1. **Name and IDs.** `app.json` uses the name "Unbound" and the IDs `com.unbound.currentaffairs`. Change them now if needed; store IDs can't be changed after the first release.
2. **Icons and splash.** `assets/` still has Expo's placeholder images. Replace them with your logo (icon 1024×1024; Android adaptive foreground on transparent).
3. **EAS project.** Run `npx eas-cli@latest init`. This adds `extra.eas.projectId`, which push notifications need. Until then the app skips push registration and logs a warning.
4. **API URL.** Set `extra.apiUrl` in `app.json` (or `EXPO_PUBLIC_API_URL` in the build profile) to your production API over HTTPS.
5. **Store links.** Fill in `extra.storeUrl.ios` / `.android` so the "Update required" screen can link to the store.
6. **Google sign-in.** Create OAuth client IDs (web, iOS, Android) in Google Cloud Console, put them in `extra.googleClientIds`, and put all of them in the server's `GOOGLE_CLIENT_IDS`. The button stays hidden until both are set.
7. **Apple sign-in.** Already enabled in `app.json` (`ios.usesAppleSignIn`). Put the bundle ID in the server's `APPLE_CLIENT_IDS`. Apple requires its option whenever Google sign-in is offered on iOS.
8. **Push.** On the server, set `PUSH_ENABLED=true` (and optionally `EXPO_ACCESS_TOKEN`). For iOS, EAS sets up the APNs key during the first `eas build`.

Then: `npx eas-cli@latest build --platform android` (or `ios`).

## Code layout

```
src/app/            Screens (Expo Router: every file is a route)
  (tabs)/           Today, Explore, Quizzes, Saved, Profile
  (auth)/           Login and register (modal)
  article/[id].js   Article
  quiz/[id].js      Quiz player
  result/[id].js    Result with explanations
src/components/     Shared UI
src/lib/            API client, auth, data hooks (React Query), push, storage
src/theme/          Colours, spacing, type scale
```
