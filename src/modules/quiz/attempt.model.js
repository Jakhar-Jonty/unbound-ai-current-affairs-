'use strict';
const mongoose = require('mongoose');

/**
 * A user's attempt at a quiz. Each answer snapshots the question version and the
 * correct option at the time of the attempt, so later corrections never silently
 * change a past score. Subjects are copied for per-topic progress analytics.
 */
const answerSchema = new mongoose.Schema(
  {
    question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
    questionVersion: { type: Number, required: true },
    selectedIndex: { type: Number, default: null },
    correctIndex: { type: Number, required: true },
    isCorrect: { type: Boolean, required: true },
    timeMs: Number,
    subjects: [String],
    gsPaper: String,
  },
  { _id: false },
);

const attemptSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    quiz: { type: mongoose.Schema.Types.ObjectId, ref: 'Quiz', required: true },
    answers: [answerSchema],
    score: { type: Number, required: true },
    total: { type: Number, required: true },
    durationMs: Number,
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

attemptSchema.index({ user: 1, quiz: 1 }, { unique: true });
attemptSchema.index({ user: 1, submittedAt: -1 });

module.exports = { Attempt: mongoose.model('Attempt', attemptSchema) };
