/** Labels around article and quiz content, in the content language. The rest of the app is in English. */
const STRINGS = {
  en: {
    keyPoints: 'Key points', explainer: 'Explainer', whyUpsc: 'WHY IT MATTERS FOR UPSC', corrections: 'Corrections',
    sources: 'SOURCES', related: 'RELATED', minRead: (n) => `${n} min read`, updated: 'Updated', retracted: 'This article was retracted',
    noHindi: '', readIn: 'हिंदी में पढ़ें',
  },
  hi: {
    keyPoints: 'मुख्य बिंदु', explainer: 'विस्तार से', whyUpsc: 'UPSC के लिए महत्व', corrections: 'सुधार',
    sources: 'स्रोत', related: 'संबंधित लेख', minRead: (n) => `${n} मिनट`, updated: 'अद्यतन', retracted: 'यह लेख वापस ले लिया गया है',
    noHindi: 'इस लेख का हिंदी अनुवाद अभी समीक्षा में है, इसलिए यह अंग्रेज़ी में दिखाया जा रहा है।',
    readIn: 'Read in English',
  },
};

export function strings(lang) {
  return STRINGS[lang === 'hi' ? 'hi' : 'en'];
}
