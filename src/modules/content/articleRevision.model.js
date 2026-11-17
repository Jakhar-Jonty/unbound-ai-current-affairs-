'use strict';
const mongoose = require('mongoose');

/** Immutable snapshot of an article each time a version is published. */
const revisionSchema = new mongoose.Schema(
  {
    article: { type: mongoose.Schema.Types.ObjectId, ref: 'Article', required: true },
    version: { type: Number, required: true },
    snapshot: { type: mongoose.Schema.Types.Mixed, required: true },
    reason: String,
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

revisionSchema.index({ article: 1, version: 1 }, { unique: true });

module.exports = { ArticleRevision: mongoose.model('ArticleRevision', revisionSchema) };
