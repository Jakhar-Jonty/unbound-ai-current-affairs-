'use strict';
const config = require('../../config');

/**
 * Default news feeds. Override with FEEDS_JSON, e.g.
 *   FEEDS_JSON='[{"id":"pib","publisher":"PIB","url":"https://...","exclude":"optional regex"}]'
 * Optional per feed:
 * - `exclude`: drop items whose headline matches this regex (case-insensitive);
 * - `excludeUrl`: drop items whose link matches this regex (e.g. a paper's city desks);
 * - `priority`: higher numbers are written first (default 0), so explainers and
 *   official sources are not stuck behind a busy general news feed.
 * Dropped items never reach the AI, so they cost nothing.
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

// The Hindu's "national" feed mixes in its state and city desks: /news/national/<state>/<story>/
// and /news/cities/. Those are mostly local (district postings, local protests, city works)
// and made up ~80% of the feed. National stories have one segment: /news/national/<story>/.
const HINDU_LOCAL_DESKS = 'thehindu\\.com/(news/national/[^/]+/[^/]+/article\\d+|news/cities/|videos/|books/|entertainment/|sport/)';

// Indian Express Explained is high value, except its sports and culture/entertainment sections.
const IE_SOFT_SECTIONS = 'indianexpress\\.com/article/explained/explained-(sports|culture|entertainment|lifestyle|books)/';

const DEFAULT_FEEDS = [
  { id: 'rbi-press', publisher: 'Reserve Bank of India', url: 'https://www.rbi.org.in/pressreleases_rss.xml', exclude: RBI_ROUTINE, priority: 3 },
  { id: 'indianexpress-explained', publisher: 'The Indian Express', url: 'https://indianexpress.com/section/explained/feed/', excludeUrl: IE_SOFT_SECTIONS, priority: 3 },
  { id: 'downtoearth', publisher: 'Down To Earth', url: 'https://www.downtoearth.org.in/stories.rss', priority: 2 },
  { id: 'thehindu-national', publisher: 'The Hindu', url: 'https://www.thehindu.com/news/national/feeder/default.rss', excludeUrl: HINDU_LOCAL_DESKS, priority: 1 },
];

function getFeeds() {
  if (!config.pipeline.feedsJson) return DEFAULT_FEEDS;
  const feeds = JSON.parse(config.pipeline.feedsJson);
  if (!Array.isArray(feeds) || feeds.some((f) => !f.id || !f.url)) {
    throw new Error('FEEDS_JSON must be an array of {id, url, publisher, exclude?, excludeUrl?, priority?}');
  }
  for (const f of feeds) {
    // Throw early on an invalid pattern.
    if (f.exclude) new RegExp(f.exclude, 'i');
    if (f.excludeUrl) new RegExp(f.excludeUrl, 'i');
  }
  return feeds;
}

module.exports = { getFeeds, DEFAULT_FEEDS };
