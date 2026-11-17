'use strict';
const OpenAI = require('openai');

const DEFAULT_MODEL = 'gpt-5-mini';

/** OpenAI via the official SDK, using strict JSON-schema output. Reads OPENAI_API_KEY. */
function createOpenAIProvider({ model = DEFAULT_MODEL, client } = {}) {
  const openai = client || new (OpenAI.default || OpenAI)();

  return {
    name: 'openai',
    model,
    async generateJSON({ system, prompt, schema, schemaName = 'output' }) {
      const completion = await openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_schema', json_schema: { name: schemaName, schema, strict: true } },
      });
      const message = completion.choices[0]?.message;
      if (message?.refusal) throw new Error(`OpenAI declined the request: ${message.refusal}`);
      if (completion.choices[0]?.finish_reason === 'length') throw new Error('OpenAI output was truncated (length)');
      const raw = message?.content || '';
      return { raw, data: JSON.parse(raw), model: completion.model || model };
    },
  };
}

module.exports = { createOpenAIProvider, DEFAULT_MODEL };
