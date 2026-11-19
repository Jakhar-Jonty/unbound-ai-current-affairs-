'use strict';

/**
 * Content taxonomy. Every article is tagged with:
 * - the exams it is useful for (EXAMS) — the app filters the feed by the user's exams;
 * - one GS paper and one or more subjects (the UPSC/State PSC syllabus structure, which
 *   also works as a general subject map), so progress and practice can be computed per subject.
 */
const EXAMS = {
  upsc: { label: 'UPSC', labelHi: 'यूपीएससी', full: 'UPSC Civil Services' },
  'state-psc': { label: 'State PSC', labelHi: 'राज्य लोक सेवा आयोग', full: 'State Public Service Commissions' },
  ssc: { label: 'SSC', labelHi: 'एसएससी', full: 'SSC (CGL, CHSL, MTS)' },
  railways: { label: 'Railways', labelHi: 'रेलवे', full: 'Railway Recruitment Boards (NTPC, Group D)' },
  banking: { label: 'Banking', labelHi: 'बैंकिंग', full: 'Banking (IBPS, SBI, RBI)' },
  insurance: { label: 'Insurance', labelHi: 'बीमा', full: 'Insurance (LIC, NIACL)' },
  defence: { label: 'Defence', labelHi: 'रक्षा', full: 'Defence (NDA, CDS, AFCAT)' },
};
const EXAM_KEYS = Object.keys(EXAMS);

const GS_PAPERS = {
  GS1: 'GS Paper I – History, Culture, Geography, Society',
  GS2: 'GS Paper II – Polity, Governance, Social Justice, International Relations',
  GS3: 'GS Paper III – Economy, Agriculture, Environment, Science & Tech, Security, Disaster Management',
  GS4: 'GS Paper IV – Ethics, Integrity and Aptitude',
  PRELIMS: 'Prelims-only facts (schemes, indices, places, reports)',
};

const SUBJECTS = {
  'history-culture': { label: 'History, Art & Culture', labelHi: 'इतिहास, कला और संस्कृति', paper: 'GS1' },
  geography: { label: 'Geography', labelHi: 'भूगोल', paper: 'GS1' },
  society: { label: 'Indian Society', labelHi: 'भारतीय समाज', paper: 'GS1' },
  polity: { label: 'Polity & Constitution', labelHi: 'राजव्यवस्था और संविधान', paper: 'GS2' },
  governance: { label: 'Governance & Schemes', labelHi: 'शासन और योजनाएँ', paper: 'GS2' },
  'social-justice': { label: 'Social Justice, Health & Education', labelHi: 'सामाजिक न्याय, स्वास्थ्य और शिक्षा', paper: 'GS2' },
  'international-relations': { label: 'International Relations', labelHi: 'अंतरराष्ट्रीय संबंध', paper: 'GS2' },
  economy: { label: 'Indian Economy', labelHi: 'भारतीय अर्थव्यवस्था', paper: 'GS3' },
  agriculture: { label: 'Agriculture', labelHi: 'कृषि', paper: 'GS3' },
  environment: { label: 'Environment & Ecology', labelHi: 'पर्यावरण और पारिस्थितिकी', paper: 'GS3' },
  'science-tech': { label: 'Science & Technology', labelHi: 'विज्ञान और प्रौद्योगिकी', paper: 'GS3' },
  security: { label: 'Internal Security & Defence', labelHi: 'आंतरिक सुरक्षा और रक्षा', paper: 'GS3' },
  'disaster-management': { label: 'Disaster Management', labelHi: 'आपदा प्रबंधन', paper: 'GS3' },
  ethics: { label: 'Ethics', labelHi: 'नैतिकता', paper: 'GS4' },
  'reports-indices': { label: 'Reports & Indices', labelHi: 'रिपोर्ट और सूचकांक', paper: 'PRELIMS' },
  'places-in-news': { label: 'Places in News', labelHi: 'चर्चा में स्थान', paper: 'PRELIMS' },
};

const GS_PAPERS_HI = {
  GS1: 'सामान्य अध्ययन I',
  GS2: 'सामान्य अध्ययन II',
  GS3: 'सामान्य अध्ययन III',
  GS4: 'सामान्य अध्ययन IV',
  PRELIMS: 'प्रारंभिक परीक्षा',
};

const GS_PAPER_KEYS = Object.keys(GS_PAPERS);
const SUBJECT_KEYS = Object.keys(SUBJECTS);

module.exports = { EXAMS, EXAM_KEYS, GS_PAPERS, GS_PAPERS_HI, SUBJECTS, GS_PAPER_KEYS, SUBJECT_KEYS };
