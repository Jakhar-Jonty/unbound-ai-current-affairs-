// Adds settings to app.json that come from files kept out of git.
//
// google-services.json (Firebase): needed for Android push notifications and Google
// sign-in. This repository is public, so the file isn't committed:
//   - local builds: put it at mobile/google-services.json (git-ignored);
//   - EAS builds: upload it once as a file environment variable named GOOGLE_SERVICES_JSON
//     (see docs/GOOGLE.md). EAS sets the variable to the file's path during the build.
const fs = require('node:fs');
const path = require('node:path');

module.exports = ({ config }) => {
  const local = path.join(__dirname, 'google-services.json');
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON || (fs.existsSync(local) ? './google-services.json' : undefined);
  return {
    ...config,
    android: { ...config.android, ...(googleServicesFile ? { googleServicesFile } : {}) },
  };
};
