'use strict';
const config = require('../../config');
const { ingestFeeds } = require('../pipeline/ingest');
const { generateContent } = require('../pipeline/generate');
const { translateContent } = require('../pipeline/translate');
const { assembleDailyQuiz } = require('../quiz/quiz.service');
const { Quiz } = require('../quiz/quiz.model');
const push = require('../notifications/push.service');

/** All background jobs. The worker schedules them; admins can also run them on demand. */
const jobs = {
  'ingest-feeds': {
    name: 'ingest-feeds',
    schedule: config.pipeline.cron.ingest,
    lockTtlMs: 15 * 60 * 1000,
    handler: ({ log }) => ingestFeeds({ log }),
  },
  'generate-content': {
    name: 'generate-content',
    schedule: config.pipeline.cron.generate,
    lockTtlMs: 60 * 60 * 1000,
    handler: () => generateContent(),
  },
  'translate-content': {
    name: 'translate-content',
    schedule: config.pipeline.cron.translate,
    lockTtlMs: 60 * 60 * 1000,
    handler: () => translateContent(),
  },
  'daily-quiz': {
    name: 'daily-quiz',
    schedule: config.pipeline.cron.dailyQuiz,
    lockTtlMs: 10 * 60 * 1000,
    handler: async ({ params }) => {
      const result = await assembleDailyQuiz(params.date ? { date: params.date } : {});
      let notified = false;
      if (result.quiz && result.quiz.status === 'published' && !result.quiz.notifiedAt) {
        // Mark first so a retry never sends the same notification twice.
        const claimed = await Quiz.findOneAndUpdate(
          { _id: result.quiz._id, notifiedAt: null },
          { $set: { notifiedAt: new Date() } },
        );
        if (claimed) {
          await push.broadcast({
            title: "Today's current affairs quiz is live",
            body: `${result.quiz.questions.length} questions from the latest news. Takes about 5 minutes.`,
            data: { type: 'quiz', quizId: String(result.quiz._id) },
          });
          notified = true;
        }
      }
      return { created: result.created, reason: result.reason, quizId: result.quiz?._id, questions: result.quiz?.questions?.length || 0, notified };
    },
  },
};

module.exports = { jobs };
