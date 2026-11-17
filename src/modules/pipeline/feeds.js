'use strict';
const config = require('../../config');

/**
 * Default news feeds. Override with FEEDS_JSON, e.g.
 *   FEEDS_JSON='[{"id":"pib","publisher":"PIB","url":"https://..."}]'
 * Only headline, summary and link are stored from feeds; explainers are written
 * fresh by the pipeline and always link back to the original source.
 */
const DEFAULT_FEEDS = [
  { id: 'pib-english', publisher: 'Press Information Bureau', url: 'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3' },
  { id: 'thehindu-national', publisher: 'The Hindu', url: 'https://www.thehindu.com/news/national/feeder/default.rss' },
  { id: 'indianexpress-explained', publisher: 'The Indian Express', url: 'https://indianexpress.com/section/explained/feed/' },
  { id: 'downtoearth', publisher: 'Down To Earth', url: 'https://www.downtoearth.org.in/stories.rss' },
];

function getFeeds() {
  if (!config.pipeline.feedsJson) return DEFAULT_FEEDS;
  const feeds = JSON.parse(config.pipeline.feedsJson);
  if (!Array.isArray(feeds) || feeds.some((f) => !f.id || !f.url)) {
    throw new Error('FEEDS_JSON must be an array of {id, url, publisher}');
  }
  return feeds;
}

module.exports = { getFeeds, DEFAULT_FEEDS };
