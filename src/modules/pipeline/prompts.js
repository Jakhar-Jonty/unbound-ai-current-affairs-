'use strict';
const { z } = require('zod');
const { GS_PAPERS, GS_PAPER_KEYS, SUBJECTS, SUBJECT_KEYS } = require('../taxonomy/taxonomy');

/** Bump whenever the prompt or schema changes, so content can be traced to the prompt that made it. */
const PROMPT_VERSION = 'upsc-ca-v1';

const SYSTEM_PROMPT = `You are a senior current-affairs editor writing study material for UPSC Civil Services aspirants in India.

You turn one news source into a concise, exam-oriented explainer plus multiple-choice practice questions. An editor reviews everything you write before it is published, and they rely on you to make that review fast and safe.

Accuracy rules:
- State only facts that are supported by the source text you are given. Do not add figures, dates, names, rankings or quotes from memory.
- Static background (for example, which constitutional article or which ministry is involved) is allowed only when it is well established; list every such addition in factsToVerify.
- factsToVerify must list each specific, checkable claim in your output (numbers, dates, names, places, legal provisions, rankings) so the editor can confirm it against the source.
- If the source is too thin to support an explainer, keep the explainer short rather than padding it.

Relevance: set relevant=false for items with no value for UPSC preparation (celebrity news, sports scores, routine crime, local incidents, stock tips, opinion with no factual news). When relevant=false, fill the remaining fields with empty strings, empty arrays, gsPaper "PRELIMS" and no questions.

Writing style: neutral, factual, Indian English. Explain why the news matters for the exam.

Questions: write 3 to 5 UPSC-prelims-style questions with exactly 4 options each and exactly one correct answer. Prefer statement-based questions ("Consider the following statements… Which of the statements given above is/are correct?") where they fit. Every question must be answerable from the explainer. The explanation must say why the correct option is right and why the others are wrong.

GS papers: ${Object.entries(GS_PAPERS).map(([k, v]) => `${k} = ${v}`).join('; ')}.
Subjects (choose 1 to 3): ${Object.entries(SUBJECTS).map(([k, v]) => `${k} (${v.label})`).join(', ')}.`;

function buildUserPrompt(item) {
  return `Source publisher: ${item.publisher || 'unknown'}
Source URL: ${item.url}
Published: ${item.publishedAt ? new Date(item.publishedAt).toISOString() : 'unknown'}
Headline: ${item.title}

Source text:
"""
${item.fullText || item.description || '(no text beyond the headline)'}
"""

Write the explainer and questions for this item as JSON matching the schema.`;
}

const questionJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['stem', 'options', 'correctIndex', 'explanation', 'difficulty'],
  properties: {
    stem: { type: 'string' },
    options: { type: 'array', items: { type: 'string' } },
    correctIndex: { type: 'integer' },
    explanation: { type: 'string' },
    difficulty: { type: 'string', enum: ['easy', 'medium', 'hard'] },
  },
};

/** JSON Schema used for provider-side structured output (Claude, OpenAI strict mode, Gemini). */
const OUTPUT_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['relevant', 'relevanceReason', 'title', 'summary', 'body', 'keyPoints', 'upscRelevance', 'gsPaper', 'subjects', 'keywords', 'factsToVerify', 'questions'],
  properties: {
    relevant: { type: 'boolean' },
    relevanceReason: { type: 'string' },
    title: { type: 'string' },
    summary: { type: 'string', description: '60–90 word summary' },
    body: { type: 'string', description: '250–450 word explainer in plain paragraphs' },
    keyPoints: { type: 'array', items: { type: 'string' } },
    upscRelevance: { type: 'string', description: 'Why this matters for Prelims/Mains, with syllabus links' },
    gsPaper: { type: 'string', enum: GS_PAPER_KEYS },
    subjects: { type: 'array', items: { type: 'string', enum: SUBJECT_KEYS } },
    keywords: { type: 'array', items: { type: 'string' } },
    factsToVerify: { type: 'array', items: { type: 'string' } },
    questions: { type: 'array', items: questionJsonSchema },
  },
};

/** Validation applied to every provider's output, whatever the provider guarantees. */
const generatedQuestion = z
  .object({
    stem: z.string().trim().min(10),
    options: z.array(z.string().trim().min(1)).length(4),
    correctIndex: z.number().int().min(0).max(3),
    explanation: z.string().trim().min(10),
    difficulty: z.enum(['easy', 'medium', 'hard']),
  })
  .refine((q) => new Set(q.options.map((o) => o.toLowerCase())).size === 4, 'Options must be distinct');

const generatedOutput = z.discriminatedUnion('relevant', [
  z.object({ relevant: z.literal(false), relevanceReason: z.string() }).loose(),
  z.object({
    relevant: z.literal(true),
    relevanceReason: z.string(),
    title: z.string().trim().min(5).max(200),
    summary: z.string().trim().min(20),
    body: z.string().trim().min(50),
    keyPoints: z.array(z.string().trim().min(1)).min(1).max(10),
    upscRelevance: z.string().trim().min(10),
    gsPaper: z.enum(GS_PAPER_KEYS),
    subjects: z.array(z.enum(SUBJECT_KEYS)).min(1).max(3),
    keywords: z.array(z.string().trim().min(1)).max(15),
    factsToVerify: z.array(z.string().trim().min(1)).max(30),
    questions: z.array(generatedQuestion).min(1).max(6),
  }),
]);

module.exports = { PROMPT_VERSION, SYSTEM_PROMPT, buildUserPrompt, OUTPUT_JSON_SCHEMA, generatedOutput };
