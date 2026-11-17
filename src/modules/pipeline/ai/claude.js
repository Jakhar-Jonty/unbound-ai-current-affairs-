'use strict';
const Anthropic = require('@anthropic-ai/sdk');

const DEFAULT_MODEL = 'claude-opus-5-5';
// Models that accept server-side refusal fallbacks with `fallbacks: "default"`.
const FALLBACK_MODELS = new Set(['claude-opus-5-5', 'claude-opus-5', 'claude-fable-5-2', 'claude-fable-5-1', 'claude-sonnet-5-5']);

/** Claude via the official Anthropic SDK. Reads ANTHROPIC_API_KEY from the environment. */
function createClaudeProvider({ model = DEFAULT_MODEL, maxOutputTokens = 16000, effort = 'high', client } = {}) {
  const anthropic = client || new (Anthropic.default || Anthropic)();

  return {
    name: 'claude',
    model,
    async generateJSON({ system, prompt, schema }) {
      const useFallbacks = FALLBACK_MODELS.has(model);
      const params = {
        model,
        max_tokens: maxOutputTokens,
        system,
        messages: [{ role: 'user', content: prompt }],
        thinking: { type: 'adaptive' },
        output_config: { effort, format: { type: 'json_schema', schema } },
      };
      const response = useFallbacks
        ? await anthropic.beta.messages.create({ ...params, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' })
        : await anthropic.messages.create(params);

      if (response.stop_reason === 'refusal') {
        throw new Error(`Claude declined the request (${response.stop_details?.category || 'unspecified'})`);
      }
      if (response.stop_reason === 'max_tokens') {
        throw new Error('Claude output hit max_tokens before finishing; raise AI_MAX_OUTPUT_TOKENS');
      }
      const raw = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
      return { raw, data: JSON.parse(raw), model: response.model || model };
    },
  };
}

module.exports = { createClaudeProvider, DEFAULT_MODEL };
