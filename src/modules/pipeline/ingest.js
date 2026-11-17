'use strict';
const { XMLParser } = require('fast-xml-parser');
const config = require('../../config');
const { RawItem } = require('./rawItem.model');
const { getFeeds } = require('./feeds');
const { stripHtml } = require('../../lib/text');
const { assignStories } = require('./stories');

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', textNodeName: '#text' });

const USER_AGENT = 'Mozilla/5.0 (compatible; CurrentAffairsBot/1.0)';

function text(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'object') return String(v['#text'] ?? '');
  return String(v);
}

function linkOf(entry) {
  const l = entry.link;
  if (typeof l === 'string') return l.trim();
  if (Array.isArray(l)) {
    const alt = l.find((x) => !x['@_rel'] || x['@_rel'] === 'alternate') || l[0];
    return text(alt['@_href'] ?? alt).trim();
  }
  if (l && typeof l === 'object') return text(l['@_href'] ?? l).trim();
  return text(entry.guid).trim();
}

/** Parses RSS 2.0 or Atom XML into normalised items. */
function parseFeed(xml) {
  const doc = parser.parse(xml);
  const rssItems = doc?.rss?.channel?.item;
  const atomEntries = doc?.feed?.entry;
  const entries = [].concat(rssItems || atomEntries || []);
  return entries
    .map((e) => ({
      title: stripHtml(text(e.title)),
      url: linkOf(e),
      description: stripHtml(text(e.description ?? e.summary ?? e.content)).slice(0, 2000),
      publishedAt: (() => {
        const d = new Date(text(e.pubDate ?? e.published ?? e.updated ?? e['dc:date']));
        return Number.isNaN(d.getTime()) ? undefined : d;
      })(),
    }))
    .filter((i) => i.title && /^https?:\/\//.test(i.url));
}

async function fetchText(url, { fetchImpl = fetch, timeoutMs = 15000 } = {}) {
  const res = await fetchImpl(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml, application/xml, text/xml, text/html' },
    signal: AbortSignal.timeout(timeoutMs),
    redirect: 'follow',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

/**
 * Pulls every configured feed and stores new items. Duplicate URLs are ignored, so
 * the job can run as often as needed. One failing feed does not stop the others.
 */
async function ingestFeeds({ feeds = getFeeds(), fetchImpl = fetch, log } = {}) {
  const cutoff = new Date(Date.now() - config.pipeline.maxItemAgeHours * 3600 * 1000);
  const stats = { feeds: feeds.length, fetched: 0, inserted: 0, grouped: 0, tooOld: 0, feedErrors: [] };
  const insertedIds = [];

  for (const feed of feeds) {
    try {
      const items = parseFeed(await fetchText(feed.url, { fetchImpl }));
      stats.fetched += items.length;
      const fresh = items.filter((i) => {
        const ok = !i.publishedAt || i.publishedAt >= cutoff;
        if (!ok) stats.tooOld += 1;
        return ok;
      });
      if (!fresh.length) continue;
      const result = await RawItem.bulkWrite(
        fresh.map((i) => ({
          updateOne: {
            filter: { url: i.url },
            update: { $setOnInsert: { ...i, feedId: feed.id, publisher: feed.publisher, status: 'new' } },
            upsert: true,
          },
        })),
        { ordered: false },
      );
      stats.inserted += result.upsertedCount;
      insertedIds.push(...Object.values(result.upsertedIds || {}));
    } catch (err) {
      log?.warn({ feed: feed.id, err: err.message }, 'Feed failed');
      stats.feedErrors.push({ feed: feed.id, error: err.message });
    }
  }
  // Group items about the same event (across feeds and across runs).
  stats.grouped = (await assignStories(insertedIds)).grouped;
  return stats;
}

module.exports = { ingestFeeds, parseFeed, fetchText };
