'use strict';
const mongoose = require('mongoose');
const { GS_PAPER_KEYS, SUBJECT_KEYS } = require('../taxonomy/taxonomy');

const QUESTION_STATUSES = ['draft', 'in_review', 'published', 'rejected', 'retired'];

const questionSchema = new mongoose.Schema(
  {
    article: { type: mongoose.Schema.Types.ObjectId, ref: 'Article', index: true },
    stem: { type: String, required: true },
    options: {
      type: [String],
      validate: { validator: (v) => v.length >= 2 && v.length <= 6, message: 'A question needs 2–6 options' },
    },
    correctIndex: { type: Number, required: true, min: 0 },
    explanation: { type: String, required: true },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
    tags: {
      gsPaper: { type: String, enum: GS_PAPER_KEYS },
      subjects: [{ type: String, enum: SUBJECT_KEYS }],
    },
    status: { type: String, enum: QUESTION_STATUSES, default: 'draft', index: true },
    version: { type: Number, default: 1 },
    publishedAt: Date,
    generation: {
      provider: String,
      model: String,
      promptVersion: String,
    },
  },
  { timestamps: true },
);

questionSchema.path('correctIndex').validate(function validIndex(v) {
  return Array.isArray(this.options) && v < this.options.length;
}, 'correctIndex must point at one of the options');

questionSchema.index({ status: 1, publishedAt: -1 });

module.exports = { Question: mongoose.model('Question', questionSchema), QUESTION_STATUSES };
