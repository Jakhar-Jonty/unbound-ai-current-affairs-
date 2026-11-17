# Unbound – mobile app

React Native app (Expo SDK 58, Expo Router, JavaScript) for the current affairs platform. It talks to the backend in the repository root (`/api/v1`).

## Features

- **Today:** the daily quiz card and the latest published explainers
- **Explore:** search and filter by UPSC subject
- **Article:** summary, key points, explainer, "why it matters for UPSC", sources, corrections and retraction notices
- **Quiz:** one question at a time, jump between questions, warning about unanswered questions, then a result screen with explanations
- **Saved:** bookmarked articles and questions (with show/hide answer)
- **Profile:** daily streak, accuracy overall and by subject, change password, delete account (required by the App Store), sign out
- **Forgot password:** emailed 6-digit code, entered in the app (no app links needed)
- Light and dark mode, push notifications (tapping one opens the quiz), and a forced-update screen driven by the backend's `MIN_APP_VERSION`

People can browse without an account. Taking quizzes, bookmarks and progress need sign-in.

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

```bash
cd mobile
npm install
EXPO_PUBLIC_API_URL=http://<your-computer-ip>:4000 npx expo start
```

Scan the QR code with a development build or Expo Go. On a phone, `localhost` means the phone itself, so use your computer's LAN IP (or the deployed API URL). For the web version, run `npx expo start --web` and add `http://localhost:8081` to the backend's `CORS_ORIGINS`.

Other commands: `npx expo lint`, `npx expo export` (checks that the Android, iOS and web bundles compile).

## Before the first store build

1. **Name and IDs.** `app.json` uses the name "Unbound" and the IDs `com.unbound.currentaffairs`. Change them now if needed; store IDs can't be changed after the first release.
2. **Icons and splash.** `assets/` still has Expo's placeholder images. Replace them with your logo (icon 1024×1024; Android adaptive foreground on transparent).
3. **EAS project.** Run `npx eas-cli@latest init`. This adds `extra.eas.projectId`, which push notifications need. Until then the app skips push registration and logs a warning.
4. **API URL.** Set `extra.apiUrl` in `app.json` (or `EXPO_PUBLIC_API_URL` in the build profile) to your production API over HTTPS.
5. **Store links.** Fill in `extra.storeUrl.ios` / `.android` so the "Update required" screen can link to the store.
6. **Push.** On the server, set `PUSH_ENABLED=true` (and optionally `EXPO_ACCESS_TOKEN`). For iOS, EAS sets up the APNs key during the first `eas build`.

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
