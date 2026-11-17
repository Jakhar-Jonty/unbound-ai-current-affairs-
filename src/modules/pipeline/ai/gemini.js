'use strict';
const { GoogleGenAI } = require('@google/genai');

const DEFAULT_MODEL = 'gemini-2.5-flash';

/** Google Gemini via the official @google/genai SDK. Reads GEMINI_API_KEY. */
function createGeminiProvider({ model = DEFAULT_MODEL, client } = {}) {
  // systemInstruction and responseJsonSchema are only accepted on v1beta; newer SDKs default to v1.
  const ai = client || new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, apiVersion: 'v1beta' });

  return {
    name: 'gemini',
    model,
    // Gemini's responseJsonSchema honours minItems/maxItems (e.g. exactly 4 options).
    supportsArrayBounds: true,
    async generateJSON({ system, prompt, schema }) {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction: system,
          responseMimeType: 'application/json',
          responseJsonSchema: schema,
        },
      });
      const finish = response.candidates?.[0]?.finishReason;
      if (finish && !['STOP', 'FINISH_REASON_UNSPECIFIED'].includes(finish)) {
        throw new Error(`Gemini stopped early (${finish})`);
      }
      const raw = response.text || '';
      return { raw, data: JSON.parse(raw), model: response.modelVersion || model };
    },
  };
}

module.exports = { createGeminiProvider, DEFAULT_MODEL };
