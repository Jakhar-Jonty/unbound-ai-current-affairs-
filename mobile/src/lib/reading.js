import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * How far the user has read each article (on this device), for "Continue reading".
 * Keeps the 30 most recent.
 */
const KEY = 'reading:progress';
const LIMIT = 30;

async function load() {
  try { return JSON.parse((await AsyncStorage.getItem(KEY)) || '{}'); } catch { return {}; }
}

export async function saveProgress(article, progress) {
  if (!article?.id) return;
  const all = await load();
  all[article.id] = {
    id: article.id, title: article.title, summary: article.summary, tags: article.tags,
    readingMinutes: article.readingMinutes, publishedAt: article.publishedAt,
    progress: Math.max(all[article.id]?.progress || 0, Math.min(1, progress)), at: Date.now(),
  };
  const keep = Object.values(all).sort((a, b) => b.at - a.at).slice(0, LIMIT);
  try { await AsyncStorage.setItem(KEY, JSON.stringify(Object.fromEntries(keep.map((x) => [x.id, x])))); } catch { /* ignore */ }
}

/** The most recent article started but not finished in the last 7 days. */
export async function getContinueReading() {
  const week = Date.now() - 7 * 86400000;
  return Object.values(await load())
    .filter((x) => x.progress >= 0.1 && x.progress < 0.9 && x.at > week)
    .sort((a, b) => b.at - a.at)[0] || null;
}

export async function clearReading() {
  try { await AsyncStorage.removeItem(KEY); } catch { /* ignore */ }
}
