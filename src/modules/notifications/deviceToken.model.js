'use strict';
const mongoose = require('mongoose');

const deviceTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    token: { type: String, required: true, unique: true },
    platform: { type: String, enum: ['ios', 'android', 'web'], required: true },
    appVersion: String,
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

const notificationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    body: { type: String, required: true },
    data: mongoose.Schema.Types.Mixed,
    audience: { type: String, default: 'all' },
    sent: Number,
    failed: Number,
    removedTokens: Number,
    dryRun: Boolean,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

module.exports = {
  DeviceToken: mongoose.model('DeviceToken', deviceTokenSchema),
  Notification: mongoose.model('Notification', notificationSchema),
};
