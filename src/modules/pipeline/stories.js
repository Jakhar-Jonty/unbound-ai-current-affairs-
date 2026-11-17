'use strict';
const { RawItem } = require('./rawItem.model');
const { similarTo } = require('./similarity');

const WINDOW_HOURS = 72;

/**
 * Gives each newly collected item a storyKey. An item that closely matches one
 * collected in the last 72 hours joins that item's story; otherwise it starts a
 * new story. Items in the same batch can match each other.
 */
async function assignStories(newIds, { windowHours = WINDOW_HOURS, threshold } = {}) {
  if (!newIds.length) return { grouped: 0 };
  const fresh = await RawItem.find({ _id: { $in: newIds } }).sort({ publishedAt: 1, _id: 1 }).lean();
  const pool = await RawItem.find({
    _id: { $nin: newIds },
    storyKey: { $ne: null },
    createdAt: { $gte: new Date(Date.now() - windowHours * 3600 * 1000) },
  }).select('title description storyKey').lean();

  let grouped = 0;
  for (const item of fresh) {
    const [best] = pool.length ? similarTo(item, pool, threshold ? { threshold } : undefined) : [];
    const storyKey = best ? pool[best.index].storyKey : item._id;
    if (best) grouped += 1;
    await RawItem.updateOne({ _id: item._id }, { $set: { storyKey, ...(best ? { storyScore: Math.round(best.score * 1000) / 1000 } : {}) } });
    pool.push({ ...item, storyKey });
  }
  return { grouped };
}

module.exports = { assignStories, WINDOW_HOURS };
