'use strict';
const mongoose = require('mongoose');

const quizSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['daily', 'topic', 'custom', 'mock'], default: 'daily' },
    // Weekly mock test: the Monday (YYYY-MM-DD, IST) of the week it covers, time limit and marking.
    week: String,
    durationSeconds: Number,
    marking: { correct: Number, wrong: Number },
    // Calendar date (YYYY-MM-DD, app timezone) for daily quizzes.
    date: String,
    title: { type: String, required: true },
    questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Question' }],
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'draft', index: true },
    publishedAt: Date,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notifiedAt: Date,
  },
  { timestamps: true },
);

// One daily quiz per calendar date. Makes the assemble job safe to re-run.
quizSchema.index({ type: 1, date: 1 }, { unique: true, partialFilterExpression: { type: 'daily' } });
quizSchema.index({ type: 1, week: 1 }, { unique: true, partialFilterExpression: { type: 'mock' } });
quizSchema.index({ status: 1, publishedAt: -1 });

module.exports = { Quiz: mongoose.model('Quiz', quizSchema) };
