'use strict';
const mongoose = require('mongoose');
const { EXAM_KEYS, GS_PAPER_KEYS, SUBJECT_KEYS } = require('../taxonomy/taxonomy');

const ARTICLE_STATUSES = ['draft', 'in_review', 'published', 'rejected', 'retracted'];

const sourceSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publisher: String,
    title: String,
    publishedAt: Date,
    excerpt: String,
    // Set when another outlet's coverage was added after the article was written.
    addedLater: Boolean,
    addedAt: Date,
  },
  { _id: false },
);

const factSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    confirmed: { type: Boolean, default: false },
  },
  { _id: false },
);

const correctionSchema = new mongoose.Schema(
  {
    note: { type: String, required: true },
    version: Number,
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now },
  },
  { _id: false },
);

/**
 * Hindi version. Translated by the pipeline from the approved English (version
 * `sourceVersion`) and published by an editor. Shown to readers only while
 * published AND sourceVersion matches the article's current version, so a
 * corrected English article never shows outdated Hindi.
 */
const articleTranslationSchema = new mongoose.Schema(
  {
    title: String,
    summary: String,
    body: String,
    keyPoints: [String],
    upscRelevance: String,
    status: { type: String, enum: ['in_review', 'published'], required: true },
    sourceVersion: { type: Number, required: true },
    edited: Boolean,
    generation: { provider: String, model: String, promptVersion: String, generatedAt: Date },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    publishedAt: Date,
  },
  { _id: false },
);

const articleSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, unique: true },
    title: { type: String, required: true, trim: true },
    summary: { type: String, required: true },
    body: { type: String, required: true },
    keyPoints: [String],
    // "Why it matters for exams". Field name kept from when the app was UPSC-only.
    upscRelevance: String,
    tags: {
      // Exams this story is useful for. Empty on articles made before exam tags existed;
      // those are treated as relevant to every exam.
      exams: [{ type: String, enum: EXAM_KEYS }],
      gsPaper: { type: String, enum: GS_PAPER_KEYS, required: true },
      subjects: [{ type: String, enum: SUBJECT_KEYS }],
      keywords: [String],
    },
    sources: { type: [sourceSchema], default: [] },
    // Specific claims an editor must confirm against the sources before publishing.
    factsToVerify: { type: [factSchema], default: [] },
    status: { type: String, enum: ARTICLE_STATUSES, default: 'draft', index: true },
    version: { type: Number, default: 1 },
    eventDate: Date,
    publishedAt: Date,
    review: {
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reviewedAt: Date,
      notes: String,
    },
    retraction: {
      reason: String,
      at: Date,
      by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    },
    corrections: { type: [correctionSchema], default: [] },
    // Provenance of AI-generated content so any item can be traced and audited.
    generation: {
      provider: String,
      model: String,
      promptVersion: String,
      rawItemIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'RawItem' }],
      generatedAt: Date,
      rawOutput: { type: String, select: false },
    },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // Story grouping: all feed items about this event share this key.
    storyKey: { type: mongoose.Schema.Types.ObjectId, index: true },
    mergedInto: { type: mongoose.Schema.Types.ObjectId, ref: 'Article' },
    translations: {
      hi: { type: articleTranslationSchema, default: undefined },
    },
    // Last translation failure per language, so a bad article isn't retried forever.
    translationErrors: {
      hi: { message: String, attempts: Number, version: Number, at: Date },
    },
  },
  { timestamps: true },
);

articleSchema.index({ status: 1, publishedAt: -1 });
articleSchema.index({ 'tags.subjects': 1, status: 1, publishedAt: -1 });
articleSchema.index({ 'tags.exams': 1, status: 1, publishedAt: -1 });
articleSchema.index({ 'sources.url': 1 });
articleSchema.index({ title: 'text', summary: 'text', 'tags.keywords': 'text' });

articleSchema.index({ status: 1, 'translations.hi.status': 1 });

module.exports = { Article: mongoose.model('Article', articleSchema), ARTICLE_STATUSES };
