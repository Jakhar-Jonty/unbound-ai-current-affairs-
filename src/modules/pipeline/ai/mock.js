'use strict';

/**
 * Deterministic offline provider for local development and tests. It builds valid
 * output from the source item so the whole pipeline can run without an API key.
 * Headlines containing "[irrelevant]" are marked not relevant; "[fail]" throws.
 */
/**
 * Translation mode: marks each English string as Hindi ("[हिंदी] …"), keeping the
 * numbers so the checks pass. Article titles containing "[bad-hindi]" drop a number.
 */
function mockTranslate({ article, includeArticle, questions }) {
  const hi = (s) => `[हिंदी] ${s}`;
  const data = {
    ...(includeArticle ? {
      article: {
        title: article.title.includes('[bad-hindi]') ? hi(article.title.replace(/\d/g, '')) : hi(article.title),
        summary: hi(article.summary),
        body: hi(article.body),
        keyPoints: (article.keyPoints || []).map(hi),
        upscRelevance: hi(article.upscRelevance || 'UPSC'),
      },
    } : {}),
    questions: questions.map((q) => ({ id: String(q._id), stem: hi(q.stem), options: q.options.map(hi), explanation: hi(q.explanation) })),
  };
  return { raw: JSON.stringify(data), data, model: 'mock-1' };
}

function createMockProvider() {
  return {
    name: 'mock',
    model: 'mock-1',
    async generateJSON({ context }) {
      if (context?.kind === 'translate') return mockTranslate(context);
      const item = context?.item || {};
      const title = item.title || 'Untitled';
      if (title.includes('[fail]')) throw new Error('Mock provider failure');
      const data = title.includes('[irrelevant]')
        ? { relevant: false, relevanceReason: 'Not useful for UPSC preparation', title: '', summary: '', body: '', keyPoints: [], upscRelevance: '', gsPaper: 'PRELIMS', subjects: [], keywords: [], factsToVerify: [], questions: [] }
        : {
          relevant: true,
          relevanceReason: 'Policy development relevant to governance',
          title,
          summary: `Summary of: ${title}. ${item.description || ''}`.slice(0, 400),
          body: `Explainer for "${title}". ${item.fullText || item.description || ''} This paragraph explains the background, the key provisions and the implications for India.`,
          keyPoints: [`Key point about ${title}`, 'Second key point'],
          upscRelevance: 'Relevant to GS Paper II: government policies and interventions.',
          gsPaper: 'GS2',
          subjects: ['governance', 'polity'],
          keywords: ['scheme', 'policy'],
          factsToVerify: [`The headline claim: ${title}`],
          questions: [
            {
              stem: `Which of the following best describes the news item "${title}"?`,
              options: ['A governance reform', 'A sports result', 'A film release', 'A weather report'],
              correctIndex: 0,
              explanation: 'The item concerns a governance reform; the other options are unrelated to the news.',
              difficulty: 'easy',
            },
            {
              stem: 'Consider the following statements about the item. Which is correct?',
              options: ['Statement 1 only', 'Statement 2 only', 'Both 1 and 2', 'Neither 1 nor 2'],
              correctIndex: 2,
              explanation: 'Both statements are supported by the explainer, so option C is correct.',
              difficulty: 'medium',
            },
          ],
        };
      return { raw: JSON.stringify(data), data, model: 'mock-1' };
    },
  };
}

module.exports = { createMockProvider };
