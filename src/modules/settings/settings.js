'use strict';
const mongoose = require('mongoose');
const config = require('../../config');

/**
 * App-wide switches that admins change from the admin panel (stored in MongoDB, so
 * they apply to the API and the worker without a restart or redeploy).
 *
 * autoPublish: when on, AI-generated articles (with their questions) and Hindi
 *   translations that pass the automatic checks go live straight away instead of
 *   waiting in the review queue. Editors can still correct or retract them.
 */
// The default applies until an admin changes the setting in the admin panel.
const DEFAULTS = { autoPublish: config.pipeline.autoPublishDefault };

const settingSchema = new mongoose.Schema(
  {
    _id: String, // setting name
    value: mongoose.Schema.Types.Mixed,
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);
const Setting = mongoose.model('Setting', settingSchema);

async function getSettings() {
  const rows = await Setting.find({ _id: { $in: Object.keys(DEFAULTS) } }).lean();
  const out = { ...DEFAULTS };
  for (const r of rows) out[r._id] = r.value;
  return out;
}

async function getSetting(name) {
  return (await getSettings())[name];
}

async function updateSettings(changes, { userId } = {}) {
  for (const [name, value] of Object.entries(changes)) {
    if (!(name in DEFAULTS)) continue;
    await Setting.updateOne({ _id: name }, { $set: { value, updatedBy: userId } }, { upsert: true });
  }
  return getSettings();
}

module.exports = { Setting, DEFAULTS, getSettings, getSetting, updateSettings };
