// Locking the app to portrait makes Android add an implied requirement for a portrait
// screen, and Google Play then hides the app from tablets, Chromebooks and XR devices.
// This keeps the portrait lock but declares the screen features as optional.
const { withAndroidManifest } = require('expo/config-plugins');

const FEATURES = ['android.hardware.screen.portrait', 'android.hardware.screen.landscape'];

module.exports = function withOptionalScreenFeatures(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest['uses-feature'] = (manifest['uses-feature'] || []).filter((f) => !FEATURES.includes(f.$['android:name']));
    for (const name of FEATURES) manifest['uses-feature'].push({ $: { 'android:name': name, 'android:required': 'false' } });
    return cfg;
  });
};
