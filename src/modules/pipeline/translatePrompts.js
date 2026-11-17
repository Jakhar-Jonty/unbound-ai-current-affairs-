'use strict';
const { z } = require('zod');

/** Bump whenever the translation prompt or schema changes. */
const TRANSLATE_PROMPT_VERSION = 'upsc-hi-v1';

const TRANSLATE_SYSTEM_PROMPT = `You translate editor-approved English study material into Hindi for UPSC Civil Services aspirants who prepare in Hindi medium.

Write clear, standard Hindi in Devanagari, in the register of NCERT textbooks, PIB Hindi releases and the UPSC Hindi question paper. An editor checks your Hindi against the English before it is published.

Rules:
- Translate faithfully. Do not add, remove or change any fact, number, date, name, claim or explanation. Do not add background of your own.
- Write every number with the digits 0-9 exactly as in the English (years, amounts, percentages, article and section numbers, statement numbers). Do not spell numbers out in words and do not use Devanagari digits.
- Use the official Hindi names of institutions and offices where they exist (Reserve Bank of India → भारतीय रिज़र्व बैंक, Supreme Court → उच्चतम न्यायालय, Election Commission → भारत निर्वाचन आयोग). Transliterate other names into Devanagari.
- Use standard Hindi terms for constitutional, legal, economic and scientific concepts (अनुच्छेद, संसद, राज्यपाल, मौद्रिक नीति, जैव विविधता). The first time an important technical term appears in the body, add the English term in brackets, for example मौद्रिक नीति समिति (Monetary Policy Committee).
- Common abbreviations (RBI, GDP, UPSC, ISRO) may stay in Latin letters.
- keyPoints: the same number of points, in the same order.
- Questions: translate the stem, every option and the explanation. Keep the options in exactly the same order. Keep statement numbering (1., 2., 3.) and references such as "1 and 2 only" or "option A" exactly, so the answer key stays correct.

Return JSON matching the schema.`;

const articleSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'summary', 'body', 'keyPoints', 'upscRelevance'],
  properties: {
    title: { type: 'string' },
    summary: { type: 'string' },
    body: { type: 'string' },
    keyPoints: { type: 'array', items: { type: 'string' }, description: 'Same number of points as the English, same order' },
    upscRelevance: { type: 'string' },
  },
};

const questionSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['id', 'stem', 'options', 'explanation'],
  properties: {
    id: { type: 'string', description: 'The question id from the input, unchanged' },
    stem: { type: 'string' },
    options: { type: 'array', items: { type: 'string' }, description: 'Same number of options as the English, same order' },
    explanation: { type: 'string' },
  },
};

/** JSON Schema for the pieces that need translating (the article fields are included only when needed). */
function translationJsonSchema({ includeArticle }) {
  const required = ['questions'];
  const properties = { questions: { type: 'array', items: questionSchema } };
  if (includeArticle) {
    required.unshift('article');
    properties.article = articleSchema;
  }
  return { type: 'object', additionalProperties: false, required, properties };
}

/** The English input: article context always, article fields to translate only when needed. */
function buildTranslatePrompt({ article, includeArticle, questions }) {
  const input = {
    ...(includeArticle
      ? { article: { title: article.title, summary: article.summary, body: article.body, keyPoints: article.keyPoints, upscRelevance: article.upscRelevance } }
      : { context: { title: article.title, summary: article.summary, note: 'For context only; do not translate.' } }),
    questions: questions.map((q) => ({ id: String(q._id), stem: q.stem, options: q.options, explanation: q.explanation })),
  };
  return `Translate this into Hindi.\n\n${JSON.stringify(input, null, 2)}`;
}

// ---------- checks ----------

const DEVANAGARI = /[ऀ-ॿ]/;
const toAsciiDigits = (s) => String(s).replace(/[०-९]/g, (d) => String('०१२३४५६७८९'.indexOf(d)));

/** Numbers in a text, normalised so "1,00,000", "100000" and "१००००" compare equal. */
function numbersIn(text) {
  return (toAsciiDigits(text).match(/\d[\d,]*(?:\.\d+)?/g) || []).map((n) => n.replace(/,/g, ''));
}

/** English numbers that are missing from the Hindi (empty when every number survived). */
function missingNumbers(en, hi) {
  const have = new Set(numbersIn(hi));
  return [...new Set(numbersIn(en))].filter((n) => !have.has(n));
}

const hindiText = (min) => z.string().trim().min(min).refine((s) => DEVANAGARI.test(s), 'Must be written in Hindi (Devanagari)');

/**
 * Validates a translation against its English source. Beyond shape, it checks that
 * every number in each English field (and each option) appears in its Hindi
 * counterpart, and that option counts match, so a translation can't change facts or
 * reorder answers without being caught.
 */
function validateTranslation(data, { article, includeArticle, questions }) {
  const errors = [];
  const out = { article: null, questions: [] };
  if (includeArticle) {
    const a = data?.article;
    const shape = z.object({
      title: hindiText(3), summary: hindiText(10), body: hindiText(30),
      keyPoints: z.array(z.string().trim().min(1)), upscRelevance: hindiText(5),
    }).safeParse(a);
    if (!shape.success) errors.push(`article: ${shape.error.issues[0].path.join('.')} ${shape.error.issues[0].message}`);
    else if (shape.data.keyPoints.length !== (article.keyPoints || []).length) errors.push(`article.keyPoints: expected ${(article.keyPoints || []).length}, got ${shape.data.keyPoints.length}`);
    else {
      for (const f of ['title', 'summary', 'body', 'upscRelevance']) {
        const miss = missingNumbers(article[f] || '', shape.data[f]);
        if (miss.length) errors.push(`article.${f}: numbers missing in Hindi: ${miss.join(', ')}`);
      }
      (article.keyPoints || []).forEach((kp, i) => {
        const miss = missingNumbers(kp, shape.data.keyPoints[i]);
        if (miss.length) errors.push(`article.keyPoints.${i}: numbers missing in Hindi: ${miss.join(', ')}`);
      });
      out.article = shape.data;
    }
  }
  const byId = new Map((Array.isArray(data?.questions) ? data.questions : []).map((q) => [String(q?.id), q]));
  for (const q of questions) {
    const h = byId.get(String(q._id));
    const label = `question ${q._id}`;
    const shape = z.object({ stem: hindiText(5), options: z.array(z.string().trim().min(1)), explanation: hindiText(5) }).safeParse(h);
    if (!shape.success) { errors.push(`${label}: ${h ? `${shape.error.issues[0].path.join('.')} ${shape.error.issues[0].message}` : 'missing'}`); continue; }
    if (shape.data.options.length !== q.options.length) { errors.push(`${label}: expected ${q.options.length} options, got ${shape.data.options.length}`); continue; }
    const misses = [
      ...missingNumbers(q.stem, shape.data.stem).map((n) => `stem ${n}`),
      ...missingNumbers(q.explanation, shape.data.explanation).map((n) => `explanation ${n}`),
      ...q.options.flatMap((o, i) => missingNumbers(o, shape.data.options[i]).map((n) => `option ${i + 1} ${n}`)),
    ];
    if (misses.length) { errors.push(`${label}: numbers missing in Hindi: ${misses.join(', ')}`); continue; }
    out.questions.push({ id: q._id, ...shape.data });
  }
  return errors.length ? { success: false, error: errors.slice(0, 4).join('; ') } : { success: true, data: out };
}

module.exports = {
  TRANSLATE_PROMPT_VERSION, TRANSLATE_SYSTEM_PROMPT, translationJsonSchema, buildTranslatePrompt,
  validateTranslation, missingNumbers, numbersIn,
};
