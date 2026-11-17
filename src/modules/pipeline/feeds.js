'use strict';
const config = require('../../config');

/**
 * Default news feeds. Override with FEEDS_JSON, e.g.
 *   FEEDS_JSON='[{"id":"pib","publisher":"PIB","url":"https://...","exclude":"optional regex"}]'
 * `exclude` drops items whose headline matches (case-insensitive) before they reach the AI.
 * Only headline, summary and link are stored from feeds; explainers are written
 * fresh by the pipeline and always link back to the original source.
 *
 * PIB is not a default: pib.gov.in returns 403 to automated clients. Add it via
 * FEEDS_JSON if that changes (the English feed needs `&reg=3`, otherwise it
 * redirects to Hindi).
 */
const RBI_ROUTINE = [
  'auction', 'money market operations', 'reverse repo', 'repo rate auction', 'treasury bill',
  'government securities', 'state government securities', 'sovereign gold bond', 'redemption price',
  'cut-off', 'devolvement', 'reference rate', 'liquidity adjustment', 'standing deposit',
  'imposes monetary penalty', 'cancels certificate of registration', 'directions under section 35a',
].join('|');

const DEFAULT_FEEDS = [
  { id: 'rbi-press', publisher: 'Reserve Bank of India', url: 'https://www.rbi.org.in/pressreleases_rss.xml', exclude: RBI_ROUTINE },
  { id: 'thehindu-national', publisher: 'The Hindu', url: 'https://www.thehindu.com/news/national/feeder/default.rss' },
  { id: 'indianexpress-explained', publisher: 'The Indian Express', url: 'https://indianexpress.com/section/explained/feed/' },
  { id: 'downtoearth', publisher: 'Down To Earth', url: 'https://www.downtoearth.org.in/stories.rss' },
];

function getFeeds() {
  if (!config.pipeline.feedsJson) return DEFAULT_FEEDS;
  const feeds = JSON.parse(config.pipeline.feedsJson);
  if (!Array.isArray(feeds) || feeds.some((f) => !f.id || !f.url)) {
    throw new Error('FEEDS_JSON must be an array of {id, url, publisher, exclude?}');
  }
  for (const f of feeds) {
    if (f.exclude) new RegExp(f.exclude, 'i'); // throws early on an invalid pattern
  }
  return feeds;
}

module.exports = { getFeeds, DEFAULT_FEEDS };
