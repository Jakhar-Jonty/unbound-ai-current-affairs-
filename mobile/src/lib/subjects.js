// Built-in copy of the subject names (from the backend taxonomy), used when
// the app is offline and hasn't loaded /taxonomy yet.
export const SUBJECT_LABELS = {
  'history-culture': 'History, Art & Culture',
  geography: 'Geography',
  society: 'Indian Society',
  polity: 'Polity & Constitution',
  governance: 'Governance & Schemes',
  'social-justice': 'Social Justice, Health & Education',
  'international-relations': 'International Relations',
  economy: 'Indian Economy',
  agriculture: 'Agriculture',
  environment: 'Environment & Ecology',
  'science-tech': 'Science & Technology',
  security: 'Internal Security & Defence',
  'disaster-management': 'Disaster Management',
  ethics: 'Ethics',
  'reports-indices': 'Reports & Indices',
  'places-in-news': 'Places in News'
};

export const SUBJECT_LABELS_HI = {
  'history-culture': 'इतिहास, कला और संस्कृति',
  geography: 'भूगोल',
  society: 'भारतीय समाज',
  polity: 'राजव्यवस्था और संविधान',
  governance: 'शासन और योजनाएँ',
  'social-justice': 'सामाजिक न्याय, स्वास्थ्य और शिक्षा',
  'international-relations': 'अंतरराष्ट्रीय संबंध',
  economy: 'भारतीय अर्थव्यवस्था',
  agriculture: 'कृषि',
  environment: 'पर्यावरण और पारिस्थितिकी',
  'science-tech': 'विज्ञान और प्रौद्योगिकी',
  security: 'आंतरिक सुरक्षा और रक्षा',
  'disaster-management': 'आपदा प्रबंधन',
  ethics: 'नैतिकता',
  'reports-indices': 'रिपोर्ट और सूचकांक',
  'places-in-news': 'चर्चा में स्थान',
};

// Exams the feed can be filtered by (same keys as the backend taxonomy).
export const EXAM_KEYS = ['upsc', 'state-psc', 'ssc', 'railways', 'banking', 'insurance', 'defence'];
export const EXAM_LABELS = { upsc: 'UPSC', 'state-psc': 'State PSC', ssc: 'SSC', railways: 'Railways', banking: 'Banking', insurance: 'Insurance', defence: 'Defence' };
export const EXAM_LABELS_HI = { upsc: 'यूपीएससी', 'state-psc': 'राज्य लोक सेवा आयोग', ssc: 'एसएससी', railways: 'रेलवे', banking: 'बैंकिंग', insurance: 'बीमा', defence: 'रक्षा' };
export const examLabel = (key, lang) => (lang === 'hi' ? EXAM_LABELS_HI[key] : EXAM_LABELS[key]) || key;
