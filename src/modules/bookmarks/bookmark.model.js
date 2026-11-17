'use strict';
const mongoose = require('mongoose');

const bookmarkSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    itemType: { type: String, enum: ['article', 'question'], required: true },
    item: { type: mongoose.Schema.Types.ObjectId, required: true, refPath: 'itemModel' },
    itemModel: { type: String, enum: ['Article', 'Question'], required: true },
    note: { type: String, maxlength: 500 },
  },
  { timestamps: true },
);

bookmarkSchema.index({ user: 1, itemType: 1, item: 1 }, { unique: true });
bookmarkSchema.index({ user: 1, createdAt: -1 });

module.exports = { Bookmark: mongoose.model('Bookmark', bookmarkSchema) };
