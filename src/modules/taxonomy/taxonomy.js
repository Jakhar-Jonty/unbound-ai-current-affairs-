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
  'history-culture': { label: 'History, Art & Culture', paper: 'GS1' },
  geography: { label: 'Geography', paper: 'GS1' },
  society: { label: 'Indian Society', paper: 'GS1' },
  polity: { label: 'Polity & Constitution', paper: 'GS2' },
  governance: { label: 'Governance & Schemes', paper: 'GS2' },
  'social-justice': { label: 'Social Justice, Health & Education', paper: 'GS2' },
  'international-relations': { label: 'International Relations', paper: 'GS2' },
  economy: { label: 'Indian Economy', paper: 'GS3' },
  agriculture: { label: 'Agriculture', paper: 'GS3' },
  environment: { label: 'Environment & Ecology', paper: 'GS3' },
  'science-tech': { label: 'Science & Technology', paper: 'GS3' },
  security: { label: 'Internal Security & Defence', paper: 'GS3' },
  'disaster-management': { label: 'Disaster Management', paper: 'GS3' },
  ethics: { label: 'Ethics', paper: 'GS4' },
  'reports-indices': { label: 'Reports & Indices', paper: 'PRELIMS' },
  'places-in-news': { label: 'Places in News', paper: 'PRELIMS' },
};

const GS_PAPER_KEYS = Object.keys(GS_PAPERS);
const SUBJECT_KEYS = Object.keys(SUBJECTS);

module.exports = { GS_PAPERS, SUBJECTS, GS_PAPER_KEYS, SUBJECT_KEYS };
