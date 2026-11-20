'use strict';
const express = require('express');
const { validate, pagination, objectId, z } = require('../../lib/validate');
const { notFound, badRequest } = require('../../lib/errors');
const { requireAuth, requireRole } = require('../users/auth.middleware');
const { User, ROLES } = require('../users/user.model');
const { Article, ARTICLE_STATUSES } = require('../content/article.model');
const { ArticleRevision } = require('../content/articleRevision.model');
const { uniqueSlug } = require('../content/content.service');
const { Question } = require('../quiz/question.model');
const { Quiz } = require('../quiz/quiz.model');
const { RawItem } = require('../pipeline/rawItem.model');
const { JobRun } = require('../jobs/job.models');
const { runJob } = require('../jobs/runner');
const { jobs } = require('../jobs/registry');
const push = require('../notifications/push.service');
const { AuditLog, audit } = require('./auditLog.model');
const editorial = require('./editorial.service');
const translation = require('./translation.service');
const { EXAM_KEYS, GS_PAPER_KEYS, SUBJECT_KEYS } = require('../taxonomy/taxonomy');
const { similarTo } = require('../pipeline/similarity');

const router = express.Router();
router.use(requireAuth, requireRole('editor'));
const adminOnly = requireRole('admin');

const idParam = (req) => objectId.parse(req.params.id);

// ---------- Dashboard ----------
// App-wide switches. Everyone on the editorial team can see them; only admins change them.
router.get('/settings', async (_req, res) => {
  res.json({ settings: await require('../settings/settings').getSettings() });
});

router.patch('/settings', adminOnly, validate(z.object({ autoPublish: z.boolean().optional() })), async (req, res) => {
  const settings = await require('../settings/settings').updateSettings(req.valid.body, { userId: req.user._id });
  await audit(req, 'settings.update', 'Setting', null, req.valid.body);
  res.json({ settings });
});

router.get('/dashboard', async (_req, res) => {
  const countBy = async (Model) => Object.fromEntries(
    (await Model.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }])).map((r) => [r._id, r.n]),
  );
  const [articles, questions, rawItems, lastRuns, hindiReview, hindiFailed, hindiPending] = await Promise.all([
    countBy(Article), countBy(Question), countBy(RawItem),
    JobRun.aggregate([{ $sort: { startedAt: -1 } }, { $group: { _id: '$name', run: { $first: '$$ROOT' } } }]),
    translation.listForReview('in_review'), translation.listForReview('failed'), translation.listForReview('pending'),
  ]);
  res.json({
    articles, questions, rawItems,
    hindi: { inReview: hindiReview.length, failed: hindiFailed.length, pending: hindiPending.length },
    jobs: Object.keys(jobs).map((name) => {
      const r = lastRuns.find((x) => x._id === name)?.run;
      return { name, schedule: jobs[name].schedule, lastRun: r ? { status: r.status, startedAt: r.startedAt, durationMs: r.durationMs, stats: r.stats, error: r.error } : null };
    }),
  });
});

// ---------- Articles ----------
router.get('/articles', validate(pagination.extend({ status: z.enum(ARTICLE_STATUSES).optional(), q: z.string().max(100).optional() }), 'query'), async (req, res) => {
  const { page, limit, status, q } = req.valid.query;
  const filter = { ...(status ? { status } : {}), ...(q ? { $text: { $search: q } } : {}) };
  const [items, total] = await Promise.all([
    Article.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
      .select('slug title status version tags createdAt publishedAt review.auto generation.provider generation.model factsToVerify sources.publisher').lean(),
    Article.countDocuments(filter),
  ]);
  res.json({ items, page, limit, total });
});

router.get('/articles/:id', async (req, res) => {
  const article = await editorial.getArticleOr404(idParam(req), { withRaw: true });
  const [questions, revisions, history] = await Promise.all([
    Question.find({ article: article._id }).sort({ createdAt: 1 }).lean(),
    ArticleRevision.find({ article: article._id }).sort({ version: -1 }).select('version reason changedBy createdAt').lean(),
    AuditLog.find({ entityId: article._id }).sort({ createdAt: -1 }).limit(50).populate('actor', 'name email').lean(),
  ]);
  const published = questions.filter((q) => q.status === 'published');
  res.json({ article, questions, revisions, history, hindi: translation.hindiSummary(article, published) });
});

// ---------- Hindi ----------
router.get('/translations', validate(z.object({ status: z.enum(['in_review', 'failed', 'pending']).default('in_review') }), 'query'), async (req, res) => {
  const items = await translation.listForReview(req.valid.query.status);
  res.json({
    items: items.map((a) => ({
      _id: a._id, title: a.title, titleHi: a.translations?.hi?.title, publishedAt: a.publishedAt, version: a.version,
      error: a.translationErrors?.hi?.message,
    })),
  });
});

const hindiArticleSchema = z.object({
  title: z.string().trim().min(3).max(300),
  summary: z.string().trim().min(10).max(3000),
  body: z.string().trim().min(30).max(30000),
  keyPoints: z.array(z.string().trim().min(1).max(600)).max(10),
  upscRelevance: z.string().trim().max(3000),
}).partial();

router.patch('/articles/:id/translations/hi', validate(hindiArticleSchema), async (req, res) => {
  const article = await translation.editHindiArticle(idParam(req), req.valid.body);
  await audit(req, 'article.hindi_edit', 'Article', article._id, { fields: Object.keys(req.valid.body) });
  res.json({ article });
});

router.patch('/questions/:id/translations/hi', validate(z.object({
  stem: z.string().trim().min(5).max(3000),
  options: z.array(z.string().trim().min(1).max(600)).min(2).max(6),
  explanation: z.string().trim().min(5).max(5000),
}).partial()), async (req, res) => {
  const question = await translation.editHindiQuestion(idParam(req), req.valid.body);
  await audit(req, 'question.hindi_edit', 'Question', question._id, { fields: Object.keys(req.valid.body) });
  res.json({ question });
});

router.post('/articles/:id/translations/hi/publish', async (req, res) => {
  const { article, published, pendingQuestions } = await translation.publishHindi(idParam(req), { userId: req.user._id });
  await audit(req, 'article.hindi_publish', 'Article', article._id, { published, pendingQuestions });
  res.json({ published, pendingQuestions });
});

router.post('/articles/:id/translations/hi/retranslate', async (req, res) => {
  const outcome = await translation.retranslate(idParam(req));
  await audit(req, 'article.hindi_retranslate', 'Article', idParam(req), { outcome });
  res.json({ outcome });
});

const tagsSchema = z.object({
  exams: z.array(z.enum(EXAM_KEYS)).min(1).max(EXAM_KEYS.length).optional(),
  gsPaper: z.enum(GS_PAPER_KEYS).optional(),
  subjects: z.array(z.enum(SUBJECT_KEYS)).min(1).max(3).optional(),
  keywords: z.array(z.string().trim().min(1).max(60)).max(15).optional(),
});
const sourceSchema = z.object({
  url: z.url(),
  publisher: z.string().max(200).optional(),
  title: z.string().max(400).optional(),
  publishedAt: z.coerce.date().optional(),
  excerpt: z.string().max(5000).optional(),
});
const articleFields = {
  title: z.string().trim().min(5).max(200),
  summary: z.string().trim().min(20).max(2000),
  body: z.string().trim().min(50).max(20000),
  keyPoints: z.array(z.string().trim().min(1).max(500)).max(10),
  upscRelevance: z.string().trim().max(2000),
  tags: tagsSchema,
  sources: z.array(sourceSchema).min(1).max(10),
  eventDate: z.coerce.date(),
  factsToVerify: z.array(z.string().trim().min(1).max(500)).max(30),
};

const questionInput = z.object({
  stem: z.string().trim().min(10).max(2000),
  options: z.array(z.string().trim().min(1).max(500)).min(2).max(6),
  correctIndex: z.number().int().min(0),
  explanation: z.string().trim().min(10).max(4000),
  difficulty: z.enum(['easy', 'medium', 'hard']).default('medium'),
});

const createArticleSchema = z.object({
  ...articleFields,
  tags: tagsSchema.required({ gsPaper: true, subjects: true }),
  keyPoints: articleFields.keyPoints.default([]),
  upscRelevance: articleFields.upscRelevance.default(''),
  factsToVerify: articleFields.factsToVerify.default([]),
  eventDate: articleFields.eventDate.optional(),
  questions: z.array(questionInput).max(10).default([]),
});

// Editors can write content by hand; it goes through the same review queue.
router.post('/articles', validate(createArticleSchema), async (req, res) => {
  const { questions, factsToVerify, ...data } = req.valid.body;
  for (const q of questions) if (q.correctIndex >= q.options.length) throw badRequest('correctIndex must point at one of the options');
  const article = await Article.create({
    ...data,
    slug: await uniqueSlug(data.title),
    factsToVerify: factsToVerify.map((text) => ({ text })),
    status: 'in_review',
    createdBy: req.user._id,
    generation: { provider: 'manual' },
  });
  if (questions.length) {
    await Question.insertMany(questions.map((q) => ({ ...q, article: article._id, tags: { gsPaper: data.tags.gsPaper, subjects: data.tags.subjects }, status: 'in_review', generation: { provider: 'manual' } })));
  }
  await audit(req, 'article.create', 'Article', article._id);
  res.status(201).json({ article });
});

const updateArticleSchema = z.object({ ...articleFields, correctionNote: z.string().trim().min(5).max(1000).optional() }).partial();

router.patch('/articles/:id', validate(updateArticleSchema), async (req, res) => {
  const { correctionNote, ...changes } = req.valid.body;
  const article = await editorial.updateArticle(idParam(req), changes, { userId: req.user._id, correctionNote });
  await audit(req, correctionNote ? 'article.correct' : Object.keys(changes).every((k) => k === 'tags') ? 'article.retag' : 'article.edit', 'Article', article._id, { fields: Object.keys(changes), correctionNote, version: article.version });
  res.json({ article });
});

router.post('/articles/:id/approve', validate(z.object({ confirmedFacts: z.array(z.number().int().min(0)).default([]), notes: z.string().max(2000).optional() })), async (req, res) => {
  const { article, questionsPublished } = await editorial.approveArticle(idParam(req), { userId: req.user._id, ...req.valid.body });
  await audit(req, 'article.publish', 'Article', article._id, { questionsPublished, notes: req.valid.body.notes });
  res.json({ article, questionsPublished });
});

const reasonSchema = z.object({ reason: z.string().trim().min(5).max(2000) });

router.post('/articles/:id/reject', validate(reasonSchema), async (req, res) => {
  const article = await editorial.rejectArticle(idParam(req), { userId: req.user._id, reason: req.valid.body.reason });
  await audit(req, 'article.reject', 'Article', article._id, req.valid.body);
  res.json({ article });
});

router.post('/articles/:id/retract', validate(reasonSchema), async (req, res) => {
  const article = await editorial.retractArticle(idParam(req), { userId: req.user._id, reason: req.valid.body.reason });
  await audit(req, 'article.retract', 'Article', article._id, req.valid.body);
  res.json({ article });
});

// Articles from the last 7 days that look like the same event (suggestions for merging).
router.get('/articles/:id/similar', async (req, res) => {
  const article = await editorial.getArticleOr404(idParam(req));
  const since = new Date((article.createdAt || new Date()).getTime() - 7 * 86400000);
  const candidates = await Article.find({ _id: { $ne: article._id }, status: { $in: ['in_review', 'draft', 'published'] }, createdAt: { $gte: since } })
    .select('title summary status createdAt sources.publisher').limit(300).lean();
  const asItem = (a) => ({ title: a.title, description: a.summary });
  const matches = similarTo(asItem(article), candidates.map(asItem), { threshold: 0.2, minSharedTitleWords: 1 }).slice(0, 5);
  res.json({
    items: matches.map((m) => {
      const a = candidates[m.index];
      return { _id: a._id, title: a.title, status: a.status, createdAt: a.createdAt, publishers: [...new Set((a.sources || []).map((src) => src.publisher).filter(Boolean))], score: Math.round(m.score * 100) / 100 };
    }),
  });
});

router.post('/articles/:id/merge', validate(z.object({ intoId: objectId })), async (req, res) => {
  const { target, source, questionsMoved } = await editorial.mergeArticles(idParam(req), req.valid.body.intoId, { userId: req.user._id });
  await audit(req, 'article.merge', 'Article', source._id, { into: target._id, questionsMoved });
  await audit(req, 'article.merge_received', 'Article', target._id, { from: source._id, questionsMoved });
  res.json({ article: target, questionsMoved });
});

router.get('/articles/:id/revisions/:version', async (req, res) => {
  const rev = await ArticleRevision.findOne({ article: idParam(req), version: Number(req.params.version) }).lean();
  if (!rev) throw notFound('Revision not found');
  res.json({ revision: rev });
});

// ---------- Questions ----------
router.post('/articles/:id/questions', validate(questionInput), async (req, res) => {
  const article = await editorial.getArticleOr404(idParam(req));
  if (['rejected', 'retracted'].includes(article.status)) throw badRequest(`Cannot add questions to a ${article.status} article`);
  if (req.valid.body.correctIndex >= req.valid.body.options.length) throw badRequest('correctIndex must point at one of the options');
  const published = article.status === 'published';
  const question = await Question.create({
    ...req.valid.body, article: article._id, tags: { gsPaper: article.tags.gsPaper, subjects: article.tags.subjects },
    status: published ? 'published' : 'in_review', publishedAt: published ? new Date() : undefined, generation: { provider: 'manual' },
  });
  await audit(req, 'question.create', 'Question', question._id, { article: article._id });
  res.status(201).json({ question });
});

const questionPatch = z.object({
  stem: questionInput.shape.stem,
  options: questionInput.shape.options,
  correctIndex: questionInput.shape.correctIndex,
  explanation: questionInput.shape.explanation,
  difficulty: z.enum(['easy', 'medium', 'hard']),
}).partial().extend({ correctionNote: z.string().trim().min(5).max(1000).optional() });

router.patch('/questions/:id', validate(questionPatch), async (req, res) => {
  const { correctionNote, ...changes } = req.valid.body;
  const question = await editorial.updateQuestion(idParam(req), changes, { correctionNote });
  await audit(req, 'question.edit', 'Question', question._id, { fields: Object.keys(changes), correctionNote, version: question.version });
  res.json({ question });
});

for (const action of ['reject', 'restore']) {
  router.post(`/questions/:id/${action}`, async (req, res) => {
    const question = await editorial.setQuestionStatus(idParam(req), action);
    await audit(req, `question.${action}`, 'Question', question._id);
    res.json({ question });
  });
}

// ---------- Quizzes ----------
router.get('/quizzes', validate(pagination, 'query'), async (req, res) => {
  const { page, limit } = req.valid.query;
  const [items, total] = await Promise.all([
    Quiz.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Quiz.countDocuments(),
  ]);
  res.json({ items, page, limit, total });
});

router.post('/quizzes', validate(z.object({
  title: z.string().trim().min(3).max(200),
  type: z.enum(['topic', 'custom']).default('custom'),
  questionIds: z.array(objectId).min(1).max(100),
})), async (req, res) => {
  const { title, type, questionIds } = req.valid.body;
  const n = await Question.countDocuments({ _id: { $in: questionIds }, status: 'published' });
  if (n !== new Set(questionIds).size) throw badRequest('All questions must exist and be published');
  const quiz = await Quiz.create({ title, type, questions: questionIds, status: 'draft', createdBy: req.user._id });
  await audit(req, 'quiz.create', 'Quiz', quiz._id);
  res.status(201).json({ quiz });
});

router.post('/quizzes/:id/publish', async (req, res) => {
  const quiz = await Quiz.findOneAndUpdate({ _id: idParam(req), status: 'draft' }, { $set: { status: 'published', publishedAt: new Date() } }, { returnDocument: 'after' });
  if (!quiz) throw notFound('Draft quiz not found');
  await audit(req, 'quiz.publish', 'Quiz', quiz._id);
  res.json({ quiz });
});

// ---------- Pipeline & jobs ----------
router.get('/raw-items', validate(pagination.extend({ status: z.enum(['new', 'processing', 'processed', 'skipped', 'failed']).optional() }), 'query'), async (req, res) => {
  const { page, limit, status } = req.valid.query;
  const filter = status ? { status } : {};
  const [items, total] = await Promise.all([
    RawItem.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    RawItem.countDocuments(filter),
  ]);
  res.json({ items, page, limit, total });
});

router.post('/raw-items/:id/retry', adminOnly, async (req, res) => {
  const item = await RawItem.findOneAndUpdate({ _id: idParam(req), status: { $in: ['failed', 'skipped'] } }, { $set: { status: 'new', attempts: 0, lastError: null } }, { returnDocument: 'after' });
  if (!item) throw notFound('Failed or skipped item not found');
  await audit(req, 'raw_item.retry', 'RawItem', item._id);
  res.json({ item });
});

router.get('/jobs/runs', validate(pagination.extend({ name: z.string().optional() }), 'query'), async (req, res) => {
  const { page, limit, name } = req.valid.query;
  const filter = name ? { name } : {};
  const [items, total] = await Promise.all([
    JobRun.find(filter).sort({ startedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    JobRun.countDocuments(filter),
  ]);
  res.json({ items, page, limit, total });
});

router.post('/jobs/:name/run', adminOnly, validate(z.object({ wait: z.enum(['true', 'false']).default('false') }), 'query'), async (req, res) => {
  const job = jobs[req.params.name];
  if (!job) throw notFound('Unknown job');
  await AuditLog.create({ actor: req.user._id, action: 'job.run', entityType: 'Job', details: { job: job.name } });
  const promise = runJob(job, { trigger: 'manual', triggeredBy: req.user._id, params: req.body || {} });
  if (req.valid.query.wait === 'true') return res.json({ run: await promise });
  promise.catch(() => {});
  return res.status(202).json({ started: true, job: job.name });
});

// ---------- Notifications ----------
router.post('/notifications', adminOnly, validate(z.object({
  title: z.string().trim().min(3).max(80),
  body: z.string().trim().min(3).max(200),
  data: z.record(z.string(), z.string()).optional(),
})), async (req, res) => {
  const result = await push.broadcast({ ...req.valid.body, createdBy: req.user._id });
  await audit(req, 'notification.send', 'Notification', result.notification._id, { devices: result.devices });
  res.status(201).json({ notificationId: result.notification._id, devices: result.devices, sent: result.sent, failed: result.failed, dryRun: result.notification.dryRun });
});

// ---------- Users & audit ----------
router.get('/users', adminOnly, validate(pagination.extend({ role: z.enum(ROLES).optional(), q: z.string().trim().max(100).optional() }), 'query'), async (req, res) => {
  const { page, limit, role, q } = req.valid.query;
  const escaped = q ? q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : null;
  const filter = { ...(role ? { role } : {}), ...(escaped ? { email: { $regex: escaped, $options: 'i' } } : {}) };
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ]);
  res.json({ items: items.map((u) => ({ ...u.toPublic(), disabled: u.disabled })), page, limit, total });
});

router.patch('/users/:id', adminOnly, validate(z.object({
  role: z.enum(ROLES).optional(),
  disabled: z.boolean().optional(),
  // Complimentary premium until this date (null removes it).
  premiumUntil: z.coerce.date().nullable().optional(),
})), async (req, res) => {
  const id = idParam(req);
  const { premiumUntil, ...rest } = req.valid.body;
  if (String(req.user._id) === id && (rest.role || rest.disabled !== undefined)) throw badRequest('You cannot change your own role or status');
  const set = { ...rest };
  if (premiumUntil !== undefined) {
    set.premium = premiumUntil ? { plan: 'complimentary', until: premiumUntil, source: 'admin', status: 'active' } : { status: 'ended' };
  }
  const user = await User.findByIdAndUpdate(id, { $set: set }, { returnDocument: 'after' });
  if (user && premiumUntil === null) await require('../billing/billing.service').syncUserPremium(user._id);
  if (!user) throw notFound('User not found');
  await audit(req, 'user.update', 'User', user._id, req.valid.body);
  res.json({ user: { ...user.toPublic(), disabled: user.disabled } });
});

router.get('/audit', validate(pagination, 'query'), async (req, res) => {
  const { page, limit } = req.valid.query;
  const [items, total] = await Promise.all([
    AuditLog.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('actor', 'name email').lean(),
    AuditLog.countDocuments(),
  ]);
  res.json({ items, page, limit, total });
});

module.exports = router;
