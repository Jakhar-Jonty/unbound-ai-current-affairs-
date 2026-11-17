import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Offline copies of articles. Saved (bookmarked) articles are pinned and kept
 * until they are unsaved; other articles the user opens are kept as "recently
 * read", up to RECENT_LIMIT, oldest dropped first.
 */
const INDEX_KEY = 'offline:index';

// Offline reading is a premium feature; set from the signed-in user's status.
let offlineAllowed = false;
export function setOfflineAllowed(v) { offlineAllowed = !!v; }
export const canUseOffline = () => offlineAllowed;
const RECENT_LIMIT = 30;
const articleKey = (id) => `offline:article:${id}`;
const bookmarksKey = (userId) => `offline:bookmarks:${userId}`;

async function readJson(key, fallback) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

async function writeJson(key, value) {
  try { await AsyncStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or unavailable */ }
}

async function prune(index) {
  const recent = Object.entries(index).filter(([, v]) => !v.pinned).sort((a, b) => b[1].at - a[1].at);
  const drop = recent.slice(RECENT_LIMIT).map(([id]) => id);
  if (drop.length) {
    drop.forEach((id) => { delete index[id]; });
    try { await AsyncStorage.multiRemove(drop.map(articleKey)); } catch { /* ignore */ }
  }
  return index;
}

export async function cacheArticle(article, { pinned } = {}) {
  if (!article?.id) return;
  const index = await readJson(INDEX_KEY, {});
  const prev = index[article.id];
  index[article.id] = { at: Date.now(), pinned: pinned ?? prev?.pinned ?? false };
  await writeJson(articleKey(article.id), article);
  await writeJson(INDEX_KEY, await prune(index));
}

export async function getCachedArticle(id) {
  return readJson(articleKey(id), null);
}

export async function isCached(id) {
  const index = await readJson(INDEX_KEY, {});
  return !!index[id];
}

/** Pins exactly the given article ids (the user's saved articles). */
export async function syncPinned(savedIds) {
  const index = await readJson(INDEX_KEY, {});
  const saved = new Set(savedIds.map(String));
  for (const [id, v] of Object.entries(index)) v.pinned = saved.has(id);
  await writeJson(INDEX_KEY, await prune(index));
  return [...saved].filter((id) => !index[id]); // saved but not downloaded yet
}

export const saveBookmarksSnapshot = (userId, data) => writeJson(bookmarksKey(userId), data);
export const getBookmarksSnapshot = (userId) => readJson(bookmarksKey(userId), null);

/** Removes all offline data (on sign-out or account deletion). */
export async function clearOffline() {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith('offline:'));
    if (keys.length) await AsyncStorage.multiRemove(keys);
  } catch { /* ignore */ }
}
