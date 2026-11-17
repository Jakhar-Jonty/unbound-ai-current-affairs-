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
    lastLoginAt: Date,
  },
  { timestamps: true },
);

userSchema.methods.toPublic = function toPublic() {
  return { id: this._id, email: this.email, name: this.name, role: this.role, createdAt: this.createdAt };
};

module.exports = { User: mongoose.model('User', userSchema), ROLES };
