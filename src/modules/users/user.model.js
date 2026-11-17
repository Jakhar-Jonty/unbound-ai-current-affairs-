'use strict';
const mongoose = require('mongoose');

const ROLES = ['user', 'editor', 'admin'];

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'user', index: true },
    disabled: { type: Boolean, default: false },
    // Bumped on password change/reset so tokens issued earlier stop working.
    tokenVersion: { type: Number, default: 0 },
    // Shown on the weekly leaderboard as "First L." unless the user opts out.
    showOnLeaderboard: { type: Boolean, default: true },
    lastLoginAt: Date,
  },
  { timestamps: true },
);

userSchema.methods.toPublic = function toPublic() {
  return { id: this._id, email: this.email, name: this.name, role: this.role, showOnLeaderboard: this.showOnLeaderboard !== false, createdAt: this.createdAt };
};

module.exports = { User: mongoose.model('User', userSchema), ROLES };
