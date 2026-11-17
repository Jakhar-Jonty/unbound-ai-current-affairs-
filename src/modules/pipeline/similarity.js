'use strict';
/**
 * Lightweight story matching: TF-IDF cosine similarity over headline + summary.
 * Runs locally (no AI calls), so it is free, fast and works with any provider.
 * Headline words count double because headlines carry the event; summaries add context.
 */

const STOPWORDS = new Set(`a about above after again against all also am an and any are as at be because been before being below
between both but by can could did do does doing down during each few for from further had has have having he her here hers
herself him himself his how i if in into is it its itself just me more most my myself no nor not now of off on once only or
other our ours ourselves out over own same she should so some such than that the their theirs them themselves then there these
they this those through to too under until up very was we were what when where which while who whom why will with would you
your yours yourself yourselves says said say amid over new latest news report reports today year years per cent percent
explained explainer what's why how know things key details here's week day first time also one two three`.split(/\s+/));

/** Very small stemmer: enough to match "rates"/"rate", "approves"/"approved"/"approve". */
function stem(w) {
  if (w.length <= 4) return w;
  for (const suf of ['ations', 'ation', 'ings', 'ing', 'ies', 'ied', 'es', 'ed', 's']) {
    if (w.endsWith(suf) && w.length - suf.length >= 3) {
      const base = w.slice(0, -suf.length);
      return suf === 'ies' || suf === 'ied' ? `${base}y` : base;
    }
  }
  return w;
}

function tokens(text = '') {
  return String(text)
    .toLowerCase()
    .replace(/(\d)[.,](\d)/g, '$1$2') // 6.5 -> 65, 1,000 -> 1000
    .replace(/[^a-z0-9ऀ-ॿ]+/g, ' ')
    .split(' ')
    .filter((w) => w.length > 1 && !STOPWORDS.has(w))
    .map(stem);
}

function termCounts(item) {
  const counts = new Map();
  const add = (t, w) => counts.set(t, (counts.get(t) || 0) + w);
  for (const t of tokens(item.title)) add(t, 2);
  for (const t of tokens(item.description).slice(0, 80)) add(t, 1);
  return counts;
}

/** Builds TF-IDF vectors for a set of items (IDF computed within the set). */
function vectorize(items) {
  const counts = items.map(termCounts);
  const df = new Map();
  for (const c of counts) for (const t of c.keys()) df.set(t, (df.get(t) || 0) + 1);
  const n = items.length;
  return counts.map((c) => {
    const v = new Map();
    let norm = 0;
    for (const [t, tf] of c) {
      const w = (1 + Math.log(tf)) * Math.log(1 + n / df.get(t));
      v.set(t, w);
      norm += w * w;
    }
    return { v, norm: Math.sqrt(norm) };
  });
}

function cosine(a, b) {
  if (!a.norm || !b.norm) return 0;
  const [small, big] = a.v.size < b.v.size ? [a, b] : [b, a];
  let dot = 0;
  for (const [t, w] of small.v) {
    const o = big.v.get(t);
    if (o) dot += w * o;
  }
  return dot / (a.norm * b.norm);
}

/** Headline-only overlap of distinctive words; guards against matches driven by summaries alone. */
function titleOverlap(a, b) {
  const ta = new Set(tokens(a.title));
  const tb = new Set(tokens(b.title));
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared += 1;
  return shared;
}

// Conservative on purpose: merging two different stories is worse than missing a duplicate
// (editors can merge missed duplicates in the admin panel).
const DEFAULT_THRESHOLD = 0.34;

/**
 * Scores `target` against `candidates` (all sharing one IDF space). Returns matches
 * at or above the threshold, best first: [{ index, score }].
 */
function similarTo(target, candidates, { threshold = DEFAULT_THRESHOLD, minSharedTitleWords = 2 } = {}) {
  const vecs = vectorize([target, ...candidates]);
  return candidates
    .map((c, i) => ({ index: i, score: cosine(vecs[0], vecs[i + 1]), shared: titleOverlap(target, c) }))
    .filter((m) => m.score >= threshold && m.shared >= minSharedTitleWords)
    .sort((x, y) => y.score - x.score);
}

module.exports = { similarTo, tokens, vectorize, cosine, DEFAULT_THRESHOLD };
