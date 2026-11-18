# Google sign-in and Android push (Firebase)

Both features use **one Firebase project**. A Firebase project *is* a Google Cloud project, so the sign-in settings live in the same place. Do this once, in order. Allow about 45 minutes.

What each piece is for:

| Piece | Where it goes | Why |
|---|---|---|
| `google-services.json` | EAS file variable `GOOGLE_SERVICES_JSON` (and `mobile/` for local builds) | Lets Android get a push token from Firebase Cloud Messaging (FCM), and lets Google sign-in find the project |
| FCM V1 service-account key | Uploaded to EAS (`eas credentials`) | Lets Expo's push service send to FCM on your behalf |
| OAuth **Web** client ID | `mobile/app.json → extra.googleClientIds.web` and the server's `GOOGLE_CLIENT_IDS` | Google signs the ID token *for* this client; the server checks the token was issued for it |
| OAuth **Android** clients (package + SHA-1) | Only in Google Cloud | Proves the request comes from your signed app. Not used in code |

> Google sign-in and push need an **app build** (`eas build`). They don't work in Expo Go. The Google button is hidden there.

## 0. Before you start

```bash
cd mobile
npx eas-cli login
npx eas-cli init          # links the app to an Expo project; adds extra.eas.projectId to app.json
```

Commit the `projectId` change. Push tokens need it.

## 1. Firebase project and Android app

1. Go to <https://console.firebase.google.com> → **Create a project** → name it `unbound-daily`. Google Analytics: **off** (the privacy policy says no analytics).
2. In the project, click the **Android** icon → **Add app**:
   - Package name: `com.unbound.daily` (must match exactly)
   - Nickname: `Unbound Daily Android`
   - SHA-1: skip for now (step 4 adds it)
3. Download **`google-services.json`**. Skip the remaining "add SDK" steps; Expo handles them.
4. Give the file to EAS (the repository is public, so it isn't committed):
   ```bash
   npx eas-cli env:create --name GOOGLE_SERVICES_JSON --type file --value ./google-services.json --visibility secret --environment production --environment preview
   ```
   (Or on expo.dev → your project → **Environment variables** → add a *File* variable with that name for both environments.) For local builds, also copy it to `mobile/google-services.json`. It's git-ignored.

## 2. Push: FCM V1 key for Expo

1. Firebase console → ⚙ **Project settings** → **Service accounts** → **Generate new private key**. A JSON file downloads. **This one is a real secret**: never commit it.
2. Upload it to EAS:
   ```bash
   npx eas-cli credentials
   # Android → production → Google Service Account → Manage your Google Service Account Key for Push Notifications (FCM V1) → Upload a new key
   ```
3. Delete the downloaded key file from your computer once it's uploaded.
4. On the server's `.env`: `PUSH_ENABLED=true`. Optionally create an access token at expo.dev → Account settings → Access tokens and set `EXPO_ACCESS_TOKEN` (then turn on "Enhanced security for push" in the Expo project).

## 3. OAuth consent screen

Google Cloud console: <https://console.cloud.google.com> → pick the **unbound-daily** project (top bar).

**APIs & Services → OAuth consent screen** (also called *Google Auth Platform*):

- User type: **External**
- App name: `Unbound Daily`; support email: your support address
- Logo: optional (adding one triggers Google's brand verification)
- App domain → Home page `https://unbounddaily.zonty.in`, Privacy policy `https://unbounddaily.zonty.in/privacy`, Terms `https://unbounddaily.zonty.in/terms`
- Authorised domain: `zonty.in`
- Scopes: only `openid`, `email` and `profile` (non-sensitive, so no Google review is needed)
- **Publish the app** (Audience → *In production*). While it's in *Testing*, only listed test users can sign in.

## 4. OAuth clients

**APIs & Services → Credentials → Create credentials → OAuth client ID.** Create these:

1. **Web application**, named `Unbound Daily (token audience)`. No redirect URIs needed for the app. To use Google sign-in on the web build, add `https://unbounddaily.zonty.in` as an authorised JavaScript origin.
   → copy its **Client ID**: `xxxx.apps.googleusercontent.com`
2. **Android**, named `Unbound Daily (EAS)`. Package `com.unbound.daily`, and SHA-1 from:
   ```bash
   npx eas-cli credentials    # Android → production → Keystore: shows the SHA1 fingerprint
   ```
3. **Android**, named `Unbound Daily (Play)`. Same package. SHA-1 from Play Console → your app → **Test and release → App integrity → App signing key certificate**. (It exists after your first upload to Play. Google Play re-signs the app with this key, so installs from Play need this client.)

Also add both SHA-1s in Firebase → Project settings → your Android app → **Add fingerprint**.

## 5. Put the IDs in place

`mobile/app.json`:

```json
"extra": {
  "googleClientIds": { "web": "xxxx.apps.googleusercontent.com", "ios": "" }
}
```

Server `.env`, then `pm2 reload ecosystem.config.js --update-env`:

```
GOOGLE_CLIENT_IDS=xxxx.apps.googleusercontent.com
```

The web client ID isn't secret; it's in every copy of the app.

## 6. Build and test

```bash
cd mobile
npx eas-cli build -p android --profile preview    # an APK you can install directly
```

On the phone:

- **Sign in → Continue with Google** opens the account picker, then you're signed in. The account's email is marked verified.
- **Profile → Notifications** on; then, from the server: `npm run job -- daily-reminder` (it only sends to people who haven't done today's quiz).

| Problem | Cause |
|---|---|
| `DEVELOPER_ERROR` from Google | The SHA-1 of the build doesn't match any Android client, or the package name differs. Check step 4 for the key that signed this build |
| Server says "Sign-in could not be verified" | `GOOGLE_CLIENT_IDS` doesn't contain the **web** client ID |
| Server says "Google sign-in isn't set up" | `GOOGLE_CLIENT_IDS` is empty on the server |
| Google button missing | Running in Expo Go, `extra.googleClientIds.web` is empty, or the server's `GOOGLE_CLIENT_IDS` is empty |
| No push token / "Push disabled: run eas init" | `extra.eas.projectId` missing (step 0), or the build had no `google-services.json` |
| Token saved but nothing arrives | FCM V1 key not uploaded (step 2), or `PUSH_ENABLED=false` on the server |

## Later: iOS

Add an iOS app in Firebase (bundle `com.unbound.daily`) and set its `GoogleService-Info.plist` as `ios.googleServicesFile` (same approach as the Android file). Create an **iOS** OAuth client, put its ID in `extra.googleClientIds.ios` and add it to `GOOGLE_CLIENT_IDS`. Apple push needs an APNs key, which `eas credentials` creates for you.
