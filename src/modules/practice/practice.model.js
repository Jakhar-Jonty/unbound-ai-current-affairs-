'use strict';
const mongoose = require('mongoose');

/** One answer given in practice mode. Feeds subject accuracy and the streak, not the leaderboard. */
const practiceAnswerSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  question: { type: mongoose.Schema.Types.ObjectId, ref: 'Question', required: true },
  questionVersion: Number,
  selectedIndex: { type: Number, required: true },
  isCorrect: { type: Boolean, required: true },
  subjects: [String],
  gsPaper: String,
  answeredAt: { type: Date, default: Date.now },
});
practiceAnswerSchema.index({ user: 1, answeredAt: -1 });
practiceAnswerSchema.index({ user: 1, question: 1 });

module.exports = { PracticeAnswer: mongoose.model('PracticeAnswer', practiceAnswerSchema) };
