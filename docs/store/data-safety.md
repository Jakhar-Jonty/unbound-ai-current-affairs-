# Play Console: Data safety, content rating and app content

Answers for **Policy → App content**. They match what the code does today and the privacy policy at `/privacy` (`src/modules/legal/content.js`). If you add analytics, crash reporting, ads or a new service, update all three.

## Data safety

**Overview questions**

| Question | Answer |
|---|---|
| Does your app collect or share any of the required user data types? | Yes |
| Is all of the user data collected by your app encrypted in transit? | Yes (HTTPS only) |
| Do you provide a way for users to request that their data is deleted? | Yes. In the app (Profile → Delete account) and on the web |
| Delete account URL | `https://unbounddaily.zonty.in/delete-account` |

**Data types**

For every type below: **Collected = Yes, Shared = No**, processed ephemerally = No, and **collection is optional** (the app can be used without an account; push tokens only with notification permission).

Service providers that process data for us (hosting, database, email, Expo push, Razorpay) don't count as "sharing" under Play's definition.

| Category → type | Purposes to tick | Why |
|---|---|---|
| Personal info → **Name** | App functionality, Account management | Account profile; first name + last initial on the leaderboard (opt-out in Profile) |
| Personal info → **Email address** | App functionality, Account management | Sign-in, verification, password reset and deletion codes |
| Personal info → **User IDs** | App functionality, Account management | Account ID; Google/Apple account ID when signing in with them |
| Financial info → **Purchase history** | App functionality, Account management | Premium plan and subscription status. *Tick only once Premium is switched on* |
| App activity → **App interactions** | App functionality | Quiz, mock and practice answers, scores, streaks |
| App activity → **Other user-generated content** | App functionality | Bookmarks and bookmark notes |
| App activity → **Other actions** | App functionality, Personalization | Followed subjects, language, notification settings |
| Device or other IDs → **Device or other IDs** | App functionality | Expo push token for reminders |

**Not collected:** location, contacts, photos/videos, audio (the audio briefing uses the phone's text-to-speech; the microphone permission is blocked), files, calendar, health, web history, installed apps, advertising ID, crash logs, diagnostics, payment card/UPI details (Razorpay handles those on its own page; the app never sees them).

**Security practices:** encrypted in transit: Yes. Users can request deletion: Yes. Independent security review: No. Committed to Play Families policy: No (the app isn't for children).

## Content rating (IARC questionnaire)

- **Category:** Reference, News, or Educational.
- Violence, sexuality, language, controlled substances, gambling: **No** to all. News stories are written as neutral explainers without graphic content.
- **Do users interact or exchange content?** No. There is no chat or user posting. The leaderboard shows first name + last initial and a score only.
- **Does the app share the user's current physical location?** No.
- **Does the app allow digital purchases?** Yes once Premium is on; No until then. Update the questionnaire when you switch Premium on.
- **Expected rating:** Everyone / 3+ (IARC). The audience is still set to adults below.

## Target audience and content

- **Target age groups:** 18 and over only. (The terms require 18+; UPSC's own minimum age is 21.)
- **Could the app unintentionally appeal to children?** No.
- **Ads:** No, the app contains no ads.

## Other declarations

| Declaration | Answer |
|---|---|
| App access | Some features need sign-in: give the reviewer account from `review-notes.md` |
| Government app | No |
| Financial features | None |
| Health | None |
| News app | **Decide.** The app is exam preparation built on current affairs. If you answer No, choose Education. If Play classifies it as News (it may), you must declare it as a news app; the contact page and editorial review already meet the requirements |
| Data deletion | `https://unbounddaily.zonty.in/delete-account` |
| Advertising ID | No (the app doesn't use it). Make sure the `AD_ID` permission is not in the build; Expo doesn't add it unless an ads or analytics library asks for it |
| Photo and video permissions | Not used |
| Foreground service, exact alarms, full-screen intent | Not used |

## Payments policy (important before switching Premium on in the Android app)

Google Play requires its own billing for digital subscriptions bought inside an Android app. `PREMIUM_PURCHASE_ANDROID` is `false` by default, so the Android app shows Premium but doesn't open the Razorpay web checkout or link to it. Keep it `false` unless you add Google Play Billing (or enrol in Play's user-choice / alternative billing programme for India and follow its rules). People can still subscribe on the website, and Premium bought there works in the app.
