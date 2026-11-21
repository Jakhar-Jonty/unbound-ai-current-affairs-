'use strict';
const mongoose = require('mongoose');

const ROLES = ['user', 'editor', 'admin'];

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    // Empty for accounts that only use Google/Apple sign-in.
    passwordHash: { type: String, select: false },
    emailVerified: { type: Boolean, default: false },
    // False for Google/Apple-only accounts (older accounts without the field all have passwords).
    hasPassword: { type: Boolean },
    providers: {
      google: { type: String, index: { unique: true, sparse: true } },
      apple: { type: String, index: { unique: true, sparse: true } },
    },
    // Premium access. `until` is the end of the paid period; access ends then unless renewed.
    premium: {
      plan: { type: String, enum: ['monthly', 'yearly', 'complimentary'] },
      until: Date,
      source: { type: String, enum: ['razorpay', 'admin'] },
      status: String, // active | cancelled (runs to period end) | halted | ended
      razorpaySubscriptionId: String,
    },
    role: { type: String, enum: ROLES, default: 'user', index: true },
    disabled: { type: Boolean, default: false },
    // Bumped on password change/reset so tokens issued earlier stop working.
    tokenVersion: { type: Number, default: 0 },
    // Shown on the weekly leaderboard as "First L." unless the user opts out.
    showOnLeaderboard: { type: Boolean, default: true },
    // Subjects the user cares most about: drives the "For you" feed and practice order.
    preferredSubjects: { type: [String], default: undefined },
    // Exams the user is preparing for (taxonomy EXAM_KEYS); the feed shows stories tagged for them.
    preferredExams: { type: [String], default: undefined },
    // App language (also used for push notifications).
    lang: { type: String, enum: ['en', 'hi'], default: 'en' },
    notificationPrefs: {
      dailyReminder: { type: Boolean, default: true },
      mock: { type: Boolean, default: true },
      // Evening digest of the day's new stories.
      digest: { type: Boolean, default: true },
    },
    lastLoginAt: Date,
  },
  { timestamps: true },
);

userSchema.methods.toPublic = function toPublic() {
  const { isPremium } = require('../billing/entitlements');
  return {
    id: this._id,
    email: this.email,
    name: this.name,
    role: this.role,
    emailVerified: !!this.emailVerified,
    hasPassword: this.hasPassword !== false,
    signInMethods: [...(this.hasPassword !== false ? ['password'] : []), ...['google', 'apple'].filter((k) => this.providers?.[k])],
    showOnLeaderboard: this.showOnLeaderboard !== false,
    preferredSubjects: this.preferredSubjects || [],
    preferredExams: this.preferredExams || [],
    lang: this.lang || 'en',
    notificationPrefs: {
      dailyReminder: this.notificationPrefs?.dailyReminder !== false,
      mock: this.notificationPrefs?.mock !== false,
      digest: this.notificationPrefs?.digest !== false,
    },
    premium: {
      active: isPremium(this),
      plan: this.premium?.plan || null,
      until: this.premium?.until || null,
      status: this.premium?.status || null,
      source: this.premium?.source || null,
    },
    createdAt: this.createdAt,
  };
};

module.exports = { User: mongoose.model('User', userSchema), ROLES };
