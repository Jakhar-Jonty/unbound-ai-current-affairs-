'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
require('./helpers');
const { createClaudeProvider } = require('../src/modules/pipeline/ai/claude');
const { createOpenAIProvider } = require('../src/modules/pipeline/ai/openai');
const { createGeminiProvider } = require('../src/modules/pipeline/ai/gemini');
const { createProvider } = require('../src/modules/pipeline/ai');
const { OUTPUT_JSON_SCHEMA, generatedOutput, parseGeneratedOutput, withArrayBounds, SYSTEM_PROMPT } = require('../src/modules/pipeline/prompts');
const { createMockProvider } = require('../src/modules/pipeline/ai/mock');

const payload = { hello: 'world' };
const input = { system: 'sys', prompt: 'user prompt', schema: { type: 'object' }, schemaName: 'x' };

test('claude adapter sends structured-output request with refusal fallbacks', async () => {
  let sent;
  const client = {
    beta: { messages: { create: async (p) => { sent = p; return { stop_reason: 'end_turn', model: p.model, content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: JSON.stringify(payload) }] }; } } },
    messages: { create: async () => { throw new Error('should use beta for fallbacks'); } },
  };
  const p = createClaudeProvider({ client });
  const r = await p.generateJSON(input);
  assert.deepEqual(r.data, payload);
  assert.equal(sent.model, 'claude-opus-5-5');
  assert.deepEqual(sent.thinking, { type: 'adaptive' });
  assert.deepEqual(sent.output_config.format, { type: 'json_schema', schema: input.schema });
  assert.equal(sent.fallbacks, 'default');
  assert.equal(sent.system, 'sys');
});

test('claude adapter surfaces refusals and truncation', async () => {
  const mk = (stop) => ({ messages: { create: async () => ({ stop_reason: stop, stop_details: { category: 'cyber' }, content: [] }) } });
  await assert.rejects(createClaudeProvider({ client: mk('refusal'), model: 'claude-haiku-5-5' }).generateJSON(input), /declined/);
  await assert.rejects(createClaudeProvider({ client: mk('max_tokens'), model: 'claude-haiku-5-5' }).generateJSON(input), /max_tokens/);
});

test('openai adapter uses strict json_schema', async () => {
  let sent;
  const client = { chat: { completions: { create: async (p) => { sent = p; return { model: p.model, choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(payload) } }] }; } } } };
  const r = await createOpenAIProvider({ client, model: 'test-model' }).generateJSON(input);
  assert.deepEqual(r.data, payload);
  assert.equal(sent.response_format.json_schema.strict, true);
  assert.equal(sent.messages[0].role, 'system');
  const refusing = { chat: { completions: { create: async () => ({ choices: [{ message: { refusal: 'no' } }] }) } } };
  await assert.rejects(createOpenAIProvider({ client: refusing }).generateJSON(input), /declined/);
});

test('gemini adapter uses JSON response schema', async () => {
  let sent;
  const client = { models: { generateContent: async (p) => { sent = p; return { text: JSON.stringify(payload), candidates: [{ finishReason: 'STOP' }] }; } } };
  const r = await createGeminiProvider({ client }).generateJSON(input);
  assert.deepEqual(r.data, payload);
  assert.equal(sent.config.responseMimeType, 'application/json');
  assert.equal(sent.config.systemInstruction, 'sys');
  const blocked = { models: { generateContent: async () => ({ text: '', candidates: [{ finishReason: 'SAFETY' }] }) } };
  await assert.rejects(createGeminiProvider({ client: blocked }).generateJSON(input), /SAFETY/);
});

test('provider factory and schema consistency', async () => {
  assert.equal(createProvider({ provider: 'mock' }).name, 'mock');
  assert.throws(() => createProvider({ provider: 'nope' }), /Unknown AI_PROVIDER/);
  // Every field the validator needs is required in the provider JSON schema.
  assert.deepEqual([...OUTPUT_JSON_SCHEMA.required].sort(), Object.keys(OUTPUT_JSON_SCHEMA.properties).sort());
  const mock = await createMockProvider().generateJSON({ context: { item: { title: 'A policy headline', url: 'https://x.test' } } });
  assert.equal(generatedOutput.safeParse(mock.data).success, true);
  const irrelevant = await createMockProvider().generateJSON({ context: { item: { title: 'Gossip [irrelevant]' } } });
  assert.equal(generatedOutput.safeParse(irrelevant.data).success, true);
  assert.match(SYSTEM_PROMPT, /factsToVerify/);
});

async function mockOutput() {
  return (await createMockProvider().generateJSON({ context: { item: { title: 'A policy headline', url: 'https://x.test' } } })).data;
}

test('array bounds are added only to a copy of the schema', () => {
  const bounded = withArrayBounds(OUTPUT_JSON_SCHEMA);
  assert.equal(bounded.properties.subjects.maxItems, 3);
  assert.equal(bounded.properties.questions.items.properties.options.minItems, 4);
  assert.equal(bounded.properties.questions.items.properties.options.maxItems, 4);
  assert.equal(OUTPUT_JSON_SCHEMA.properties.subjects.maxItems, undefined, 'shared schema stays portable (Claude rejects maxItems)');
  assert.equal(OUTPUT_JSON_SCHEMA.properties.questions.items.properties.options.maxItems, undefined);
  assert.equal(createGeminiProvider({ client: {} }).supportsArrayBounds, true);
});

test('output parser repairs small slips without changing questions', async () => {
  const out = await mockOutput();
  out.subjects = ['economy', 'economy', 'polity', 'governance', 'environment'];
  out.keywords = Array.from({ length: 20 }, (_, i) => `k${i}`);
  out.questions.push({ ...out.questions[0], options: ['a', 'b', 'c', 'd', 'e'] });
  const r = parseGeneratedOutput(out);
  assert.equal(r.success, true);
  assert.deepEqual(r.data.subjects, ['economy', 'polity', 'governance']);
  assert.equal(r.data.keywords.length, 15);
  assert.equal(r.droppedQuestions, 1, 'a question with 5 options is dropped, not edited');
  assert.equal(r.data.questions.length, 2);
  assert.deepEqual(r.data.questions[0].options, out.questions[0].options);
});

test('output parser still rejects output it cannot safely repair', async () => {
  const noValid = await mockOutput();
  noValid.questions = noValid.questions.map((q) => ({ ...q, options: ['a', 'b', 'c'] }));
  const r1 = parseGeneratedOutput(noValid);
  assert.equal(r1.success, false);
  assert.match(r1.error, /questions\.0\.options/);

  const tooManyFacts = await mockOutput();
  tooManyFacts.factsToVerify = Array.from({ length: 31 }, (_, i) => `fact ${i}`);
  assert.equal(parseGeneratedOutput(tooManyFacts).success, false, 'facts are never truncated');

  const badSubject = await mockOutput();
  badSubject.subjects = ['astrology'];
  assert.equal(parseGeneratedOutput(badSubject).success, false);

  assert.equal(parseGeneratedOutput({ relevant: false, relevanceReason: 'gossip' }).success, true);
  assert.equal(parseGeneratedOutput(null).success, false);
});
