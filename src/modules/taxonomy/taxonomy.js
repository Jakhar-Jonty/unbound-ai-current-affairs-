'use strict';

/**
 * UPSC Civil Services syllabus taxonomy. Every article and question is tagged with
 * one GS paper and one or more subjects so that progress, topic quizzes and future
 * study plans can be computed per subject.
 */
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

module.exports = { GS_PAPERS, GS_PAPERS_HI, SUBJECTS, GS_PAPER_KEYS, SUBJECT_KEYS };
