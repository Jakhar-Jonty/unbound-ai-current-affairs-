'use strict';

/**
 * Language handling for published content. English is the source of truth; Hindi
 * is a reviewed translation of a specific English version. A Hindi version is
 * served only when it is published AND was made from the current English version,
 * so corrections never leave readers with outdated Hindi. Otherwise readers get
 * English, and the response says Hindi isn't available yet.
 */
const LANGS = ['en', 'hi'];

/** The language a request asks for (?lang=hi), defaulting to English. */
function langOf(req) {
  return req?.query?.lang === 'hi' ? 'hi' : 'en';
}

const isCurrent = (doc, lang) => {
  const t = doc?.translations?.[lang];
  return !!t && t.sourceVersion === (doc.version || 1);
};
const isServable = (doc, lang) => isCurrent(doc, lang) && doc.translations[lang].status === 'published';

/** Article text in the requested language: { title, summary, body, keyPoints, upscRelevance, lang, hindiAvailable }. */
function articleText(a, lang = 'en') {
  const hindiAvailable = isServable(a, 'hi');
  if (lang === 'hi' && hindiAvailable) {
    const t = a.translations.hi;
    return { title: t.title, summary: t.summary, body: t.body, keyPoints: t.keyPoints, upscRelevance: t.upscRelevance, lang: 'hi', hindiAvailable };
  }
  return { title: a.title, summary: a.summary, body: a.body, keyPoints: a.keyPoints, upscRelevance: a.upscRelevance, lang: 'en', hindiAvailable };
}

/** Question text in the requested language: { stem, options, explanation, lang }. Options keep their order. */
function questionText(q, lang = 'en') {
  if (lang === 'hi' && isServable(q, 'hi')) {
    const t = q.translations.hi;
    return { stem: t.stem, options: t.options, explanation: t.explanation, lang: 'hi' };
  }
  return { stem: q.stem, options: q.options, explanation: q.explanation, lang: 'en' };
}

/** Pieces of an article that need a (new) Hindi translation. */
function translationNeeds(article, questions) {
  return {
    article: !isCurrent(article, 'hi'),
    questions: questions.filter((q) => !isCurrent(q, 'hi')),
  };
}

module.exports = { LANGS, langOf, articleText, questionText, isCurrent, isServable, translationNeeds };
