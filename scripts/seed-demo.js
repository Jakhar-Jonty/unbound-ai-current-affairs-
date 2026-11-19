'use strict';
/**
 * Loads demo content so the app and admin panel have something to show without
 * waiting for feeds or spending AI calls:
 *   npm run seed:demo              five published explainers, ten questions, a topic quiz and a test user
 *   npm run seed:demo -- --reset   removes everything this script created
 *
 * The test user's password comes from DEMO_PASSWORD, or is generated and printed.
 * Demo articles have slugs starting with "demo-" and generation.provider "demo".
 * Refuses to run when NODE_ENV=production.
 */
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const config = require('../src/config');
const db = require('../src/lib/db');
const { Article } = require('../src/modules/content/article.model');
const { ArticleRevision } = require('../src/modules/content/articleRevision.model');
const { Question } = require('../src/modules/quiz/question.model');
const { Quiz } = require('../src/modules/quiz/quiz.model');
const { Attempt } = require('../src/modules/quiz/attempt.model');
const { Bookmark } = require('../src/modules/bookmarks/bookmark.model');
const { PracticeAnswer } = require('../src/modules/practice/practice.model');
const { User } = require('../src/modules/users/user.model');
const { approveArticle } = require('../src/modules/admin/editorial.service');
const demoArticles = require('./demo/articles');

const DEMO_PROVIDER = 'demo';
const DEMO_EMAIL = 'student@example.com';
const DEMO_QUIZ_TITLE = 'Demo: Polity, Economy and Environment basics';

async function reset({ log = console.log } = {}) {
  const articles = await Article.find({ 'generation.provider': DEMO_PROVIDER }).select('_id').lean();
  const articleIds = articles.map((a) => a._id);
  const questions = await Question.find({ article: { $in: articleIds } }).select('_id').lean();
  const questionIds = questions.map((q) => q._id);
  // Only quizzes made entirely of demo questions; a real daily quiz is never touched.
  const quizzes = await Quiz.find({ questions: { $in: questionIds } }).lean();
  const demoIds = new Set(questionIds.map(String));
  const quizIds = quizzes.filter((q) => q.questions.every((id) => demoIds.has(String(id)))).map((q) => q._id);

  const user = await User.findOne({ email: DEMO_EMAIL }).select('_id').lean();
  const results = await Promise.all([
    Attempt.deleteMany({ quiz: { $in: quizIds } }),
    Quiz.deleteMany({ _id: { $in: quizIds } }),
    Bookmark.deleteMany({ item: { $in: [...articleIds, ...questionIds] } }),
    PracticeAnswer.deleteMany({ question: { $in: questionIds } }),
    Question.deleteMany({ _id: { $in: questionIds } }),
    ArticleRevision.deleteMany({ article: { $in: articleIds } }),
    Article.deleteMany({ _id: { $in: articleIds } }),
    ...(user ? [Attempt.deleteMany({ user: user._id }), Bookmark.deleteMany({ user: user._id }), PracticeAnswer.deleteMany({ user: user._id }), User.deleteOne({ _id: user._id })] : []),
  ]);
  const skipped = quizzes.length - quizIds.length;
  log(`Removed ${results[6].deletedCount} demo articles, ${results[4].deletedCount} questions, ${results[1].deletedCount} quizzes${user ? ' and the demo user' : ''}.`);
  if (skipped) log(`Left ${skipped} quiz(zes) that also contain real questions; demo questions in them are gone.`);
}

async function seed({ log = console.log } = {}) {
  const reviewer = await User.findOne({ role: 'admin' }).select('_id').lean();
  let created = 0;
  for (const a of demoArticles) {
    if (await Article.exists({ slug: a.slug })) continue;
    const article = await Article.create({
      slug: a.slug,
      title: a.title,
      summary: a.summary,
      body: a.body,
      keyPoints: a.keyPoints,
      upscRelevance: a.upscRelevance,
      tags: { exams: a.exams, gsPaper: a.gsPaper, subjects: a.subjects, keywords: a.keywords },
      sources: a.sources,
      factsToVerify: a.factsToVerify.map((text) => ({ text })),
      status: 'in_review',
      generation: { provider: DEMO_PROVIDER, model: 'hand-written', promptVersion: 'demo', generatedAt: new Date() },
    });
    await Question.insertMany(a.questions.map((q) => ({
      ...q,
      article: article._id,
      tags: { gsPaper: a.gsPaper, subjects: a.subjects },
      status: 'in_review',
      generation: { provider: DEMO_PROVIDER, model: 'hand-written', promptVersion: 'demo' },
    })));
    // Publish through the same rules editors follow (every fact confirmed, a question present).
    await approveArticle(article._id, {
      userId: reviewer?._id,
      confirmedFacts: a.factsToVerify.map((_, i) => i),
      notes: 'Demo content loaded by npm run seed:demo',
    });
    created += 1;
  }

  const articleIds = (await Article.find({ 'generation.provider': DEMO_PROVIDER }).select('_id').lean()).map((x) => x._id);
  const questions = await Question.find({ article: { $in: articleIds }, status: 'published' }).select('_id').lean();
  let quiz = await Quiz.findOne({ type: 'topic', title: DEMO_QUIZ_TITLE });
  if (!quiz && questions.length) {
    quiz = await Quiz.create({
      type: 'topic',
      title: DEMO_QUIZ_TITLE,
      questions: questions.map((q) => q._id),
      status: 'published',
      publishedAt: new Date(),
      createdBy: reviewer?._id,
    });
  }

  const password = process.env.DEMO_PASSWORD || crypto.randomBytes(9).toString('base64url');
  if (password.length < 8) throw new Error('DEMO_PASSWORD must be at least 8 characters');
  const existingUser = await User.exists({ email: DEMO_EMAIL });
  if (!existingUser || process.env.DEMO_PASSWORD) {
    await User.findOneAndUpdate(
      { email: DEMO_EMAIL },
      {
        $set: { passwordHash: await bcrypt.hash(password, 12), emailVerified: true, disabled: false },
        $setOnInsert: { name: 'Demo Student', role: 'user', preferredSubjects: ['polity', 'economy'] },
      },
      { upsert: true },
    );
  }

  log(`Demo articles: ${created} added, ${articleIds.length} in total (${questions.length} questions).`);
  log(quiz ? `Topic quiz: "${quiz.title}" (${quiz.questions.length} questions).` : 'No quiz created.');
  if (!existingUser || process.env.DEMO_PASSWORD) {
    log(`Test user: ${DEMO_EMAIL} / ${password}`);
  } else {
    log(`Test user ${DEMO_EMAIL} already exists; password unchanged (set DEMO_PASSWORD to reset it).`);
  }
  log('Today\'s daily quiz is left to the daily-quiz job: npm run job -- daily-quiz');
}

async function main() {
  if (config.isProd) throw new Error('seed:demo will not run with NODE_ENV=production');
  await db.connect();
  try {
    if (process.argv.includes('--reset')) await reset();
    else await seed();
  } finally {
    await db.disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => { console.error(err.message); process.exit(1); });
}

module.exports = { seed, reset, DEMO_EMAIL };
