# Notes for the Play reviewer

Paste into **Policy → App content → App access → "All or some functionality is restricted"** and add the test account.

Create the account on the production server first (sign up in the app with a mailbox you control, verify the email, take one daily quiz so there's history). Don't use an admin or editor account.

```
Username: <reviewer account email>
Password: <its password>

Unbound Daily is a UPSC (Indian civil services exam) current-affairs app.

- Articles can be read without signing in (Today and Explore tabs).
- Signing in unlocks the daily quiz, weekly mock test (opens Sundays), practice by subject, bookmarks, progress and the leaderboard. Use the account above.
- The app works in English and Hindi. Switch on the first screen or in Profile → Language.
- Account deletion: Profile → Delete account, or on the web at https://unbound.zonty.in/delete-account.
- No purchases are possible inside the Android app.
```

Before each review, check that the account still signs in and that today's quiz exists (the `daily-quiz` job has run).
