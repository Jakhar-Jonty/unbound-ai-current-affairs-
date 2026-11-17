'use strict';
const { z } = require('zod');
const { GS_PAPERS, GS_PAPER_KEYS, SUBJECTS, SUBJECT_KEYS } = require('../taxonomy/taxonomy');

/** Bump whenever the prompt or schema changes, so content can be traced to the prompt that made it. */
const PROMPT_VERSION = 'upsc-ca-v4';

const SYSTEM_PROMPT = `You are a senior current-affairs editor writing study material for UPSC Civil Services aspirants in India.

You turn one news source into a concise, exam-oriented explainer plus multiple-choice practice questions. An editor reviews everything you write before it is published, and they rely on you to make that review fast and safe.

Accuracy rules:
- State only facts that are supported by the source text you are given. Do not add figures, dates, names, rankings or quotes from memory.
- Static background (for example, which constitutional article or which ministry is involved) is allowed only when it is well established; list every such addition in factsToVerify.
- factsToVerify must list each specific, checkable claim in your output (numbers, dates, names, places, legal provisions, rankings) so the editor can confirm it against the source.
- If the source is too thin to support an explainer, keep the explainer short rather than padding it.

Several sources: you may be given more than one report of the same event from different outlets. Write one explainer that combines them. Prefer official sources (PIB, ministries, RBI, SEBI, courts, Parliament) over news reports for facts. If sources disagree on a fact, use the official one, or leave the fact out if none is official, and add the disagreement to factsToVerify (for example "Sources differ on the allocation: The Hindu says X, Indian Express says Y").

Relevance: be selective. Ask: would this plausibly be asked in UPSC Prelims or Mains, or appear in a standard monthly current-affairs compilation for the exam? If you are unsure, set relevant=false; an editor would rather review fewer, better items.

Usually relevant: central laws, bills, rules and schemes; Supreme Court and High Court judgments that settle a legal or constitutional question; constitutional and statutory bodies (Election Commission, Finance Commission, RBI, SEBI, CAG and so on); Centre–state relations and fiscal federalism; India's international relations, summits, treaties and defence exercises; official economic data and reports (GDP, inflation, trade, production, indices); environment, climate, biodiversity and disaster policy; science and technology missions; public health data and programmes; reports and rankings by national or international bodies.

Not relevant: local or district news (a road, bridge, flyover or civic project in one city, a district official's posting, a local protest, a wildlife sighting near a village); routine crime and arrests; statements, allegations and campaigning by political parties and politicians; court hearings that only concern a named person's case or conduct, with no legal principle at stake; seminars, workshops, award ceremonies and celebrity remarks; sports results; markets and stock tips; opinion pieces without new facts; live blogs that only repeat an update. A local event is relevant only if it raises a national policy, legal or constitutional issue, and then the explainer must be about that issue.

When relevant=false, fill the remaining fields with empty strings, empty arrays, gsPaper "PRELIMS" and no questions.

Writing style: neutral, factual, Indian English. Explain why the news matters for the exam.

Questions: write 3 to 5 UPSC-prelims-style questions with exactly 4 options each and exactly one correct answer. Prefer statement-based questions ("Consider the following statements… Which of the statements given above is/are correct?") where they fit. Every question must be answerable from the explainer. The explanation must say why the correct option is right and why the others are wrong.

GS papers: ${Object.entries(GS_PAPERS).map(([k, v]) => `${k} = ${v}`).join('; ')}.
Subjects (choose 1 to 3): ${Object.entries(SUBJECTS).map(([k, v]) => `${k} (${v.label})`).join(', ')}.`;

function sourceBlock(item, n) {
  return `Source ${n}
Publisher: ${item.publisher || 'unknown'}
URL: ${item.url}
Published: ${item.publishedAt ? new Date(item.publishedAt).toISOString() : 'unknown'}
Headline: ${item.title}
Text:
"""
${item.fullText || item.description || '(no text beyond the headline)'}
"""`;
}

/** One or more reports of the same event. */
function buildUserPrompt(items) {
  const list = Array.isArray(items) ? items : [items];
  const intro = list.length > 1 ? `These ${list.length} reports cover the same event.\n\n` : '';
  return `${intro}${list.map((it, i) => sourceBlock(it, i + 1)).join('\n\n')}

Write one explainer and its questions as JSON matching the schema.`;
}

const questionJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['stem', 'options', 'correctIndex', 'explanation', 'difficulty'],
  properties: {
    stem: { type: 'string' },
    options: { type: 'array', items: { type: 'string' }, description: 'Exactly 4 distinct options, without "A)"-style labels' },
    correctIndex: { type: 'integer', description: 'Index (0 to 3) of the one correct option' },
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
    keyPoints: { type: 'array', items: { type: 'string' }, description: '3 to 6 short points, at most 10' },
    upscRelevance: { type: 'string', description: 'Why this matters for Prelims/Mains, with syllabus links' },
    gsPaper: { type: 'string', enum: GS_PAPER_KEYS },
    subjects: { type: 'array', items: { type: 'string', enum: SUBJECT_KEYS }, description: '1 to 3 subjects, most relevant first' },
    keywords: { type: 'array', items: { type: 'string' }, description: 'At most 15' },
    factsToVerify: { type: 'array', items: { type: 'string' } },
    questions: { type: 'array', items: questionJsonSchema, description: '3 to 5 questions (none when relevant is false)' },
  },
};

/**
 * Array size limits as JSON Schema minItems/maxItems. Not every provider's structured
 * output accepts them (Claude allows only minItems 0 or 1), so they are added only for
 * providers that set `supportsArrayBounds`. Zod validation enforces them for everyone.
 */
const ARRAY_BOUNDS = {
  keyPoints: { maxItems: 10 },
  subjects: { maxItems: 3 },
  keywords: { maxItems: 15 },
  factsToVerify: { maxItems: 30 },
  questions: { maxItems: 6 },
};

function withArrayBounds(schema) {
  const out = structuredClone(schema);
  for (const [key, bounds] of Object.entries(ARRAY_BOUNDS)) Object.assign(out.properties[key], bounds);
  Object.assign(out.properties.questions.items.properties.options, { minItems: 4, maxItems: 4 });
  return out;
}

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

function formatIssues(error) {
  return error.issues.slice(0, 3).map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
}

/**
 * Validates provider output after a few safe, meaning-preserving repairs, so one small
 * slip doesn't throw away a whole article (and an AI call):
 * - duplicate subjects are removed and the list is cut to 3 (the model lists the most relevant first);
 * - keyPoints and keywords are cut to their maximum;
 * - invalid questions are dropped as long as at least one valid question remains.
 * Options, answer keys and factsToVerify are never changed: a question with the wrong
 * number of options is dropped, not edited, and too many facts still fails.
 * Returns { success, data, droppedQuestions } or { success: false, error }.
 */
function parseGeneratedOutput(input) {
  if (!input || typeof input !== 'object' || input.relevant !== true) {
    const parsed = generatedOutput.safeParse(input);
    return parsed.success ? { success: true, data: parsed.data, droppedQuestions: 0 } : { success: false, error: formatIssues(parsed.error) };
  }
  const data = { ...input };
  if (Array.isArray(data.subjects)) data.subjects = [...new Set(data.subjects)].slice(0, 3);
  if (Array.isArray(data.keyPoints)) data.keyPoints = data.keyPoints.slice(0, 10);
  if (Array.isArray(data.keywords)) data.keywords = data.keywords.slice(0, 15);

  let droppedQuestions = 0;
  let firstQuestionError;
  if (Array.isArray(data.questions)) {
    data.questions = data.questions.filter((q, i) => {
      const r = generatedQuestion.safeParse(q);
      if (!r.success) {
        droppedQuestions += 1;
        firstQuestionError ??= formatIssues({ issues: r.error.issues.map((x) => ({ ...x, path: ['questions', i, ...x.path] })) });
      }
      return r.success;
    });
    if (!data.questions.length && firstQuestionError) return { success: false, error: firstQuestionError };
  }
  const parsed = generatedOutput.safeParse(data);
  return parsed.success ? { success: true, data: parsed.data, droppedQuestions } : { success: false, error: formatIssues(parsed.error) };
}

module.exports = {
  PROMPT_VERSION, SYSTEM_PROMPT, buildUserPrompt, OUTPUT_JSON_SCHEMA, withArrayBounds, generatedOutput, parseGeneratedOutput,
};
