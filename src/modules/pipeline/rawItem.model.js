'use strict';
const mongoose = require('mongoose');

const RAW_STATUSES = ['new', 'processing', 'processed', 'skipped', 'failed'];

/** A news item collected from a feed, waiting to be turned into content. */
const rawItemSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, unique: true },
    feedId: { type: String, required: true, index: true },
    publisher: String,
    title: { type: String, required: true },
    description: String,
    publishedAt: Date,
    status: { type: String, enum: RAW_STATUSES, default: 'new', index: true },
    attempts: { type: Number, default: 0 },
    lastError: String,
    processingStartedAt: Date,
    skipReason: String,
    article: { type: mongoose.Schema.Types.ObjectId, ref: 'Article' },
    // Items about the same event share a storyKey (the _id of the first item seen).
    storyKey: { type: mongoose.Schema.Types.ObjectId, index: true },
    storyScore: Number, // similarity to the item it was grouped with
    attachedLater: Boolean, // added as a source to an article that already existed
  },
  { timestamps: true },
);

rawItemSchema.index({ status: 1, publishedAt: -1 });

module.exports = { RawItem: mongoose.model('RawItem', rawItemSchema), RAW_STATUSES };
