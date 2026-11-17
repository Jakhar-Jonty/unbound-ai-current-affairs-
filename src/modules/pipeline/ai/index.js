'use strict';
const config = require('../../../config');

/**
 * Returns the configured AI provider. Every provider exposes the same interface:
 *   generateJSON({ system, prompt, schema, schemaName, context }) -> { data, raw, model }
 * Switch providers with AI_PROVIDER=claude|openai|gemini|mock and AI_MODEL.
 */
function createProvider({ provider = config.ai.provider, model = config.ai.model || undefined, ...opts } = {}) {
  switch (provider) {
    case 'claude':
    case 'anthropic':
      return require('./claude').createClaudeProvider({
        model, maxOutputTokens: config.ai.maxOutputTokens, effort: process.env.AI_EFFORT || 'high', ...opts,
      });
    case 'openai':
      return require('./openai').createOpenAIProvider({ model, ...opts });
    case 'gemini':
    case 'google':
      return require('./gemini').createGeminiProvider({ model, ...opts });
    case 'mock':
      return require('./mock').createMockProvider();
    default:
      throw new Error(`Unknown AI_PROVIDER "${provider}". Use claude, openai, gemini or mock.`);
  }
}

module.exports = { createProvider };
