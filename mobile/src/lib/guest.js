import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from './api';

/**
 * What a guest does before signing in, kept on this device:
 *  - daily quiz results (graded by the server, not saved there), and
 *  - saved articles/questions (up to the free limit).
 * When the guest signs in or signs up, both move into the account.
 */
const QUIZ_KEY = 'guest:quizzes';
const SAVES_KEY = 'guest:saves';
export const GUEST_SAVE_LIMIT = 20;

async function read(key, fallback) {
  try { return JSON.parse((await AsyncStorage.getItem(key)) || 'null') ?? fallback; } catch { return fallback; }
}
async function write(key, value) {
  try { await AsyncStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
}

// ---------- quiz results ----------
export async function saveGuestQuiz(quizId, { answers, durationMs, result }) {
  const all = await read(QUIZ_KEY, {});
  all[quizId] = { quizId, answers, durationMs, result, at: Date.now() };
  // Keep the last 10.
  const keep = Object.values(all).sort((a, b) => b.at - a.at).slice(0, 10);
  await write(QUIZ_KEY, Object.fromEntries(keep.map((x) => [x.quizId, x])));
}

export async function getGuestQuiz(quizId) {
  return (await read(QUIZ_KEY, {}))[quizId] || null;
}

// ---------- saved items ----------
export const listGuestSaves = () => read(SAVES_KEY, []);

export async function isGuestSaved(itemType, itemId) {
  return (await listGuestSaves()).some((x) => x.itemType === itemType && x.itemId === itemId);
}

/** Adds or removes; returns true when saved. Throws when the free limit is reached. */
export async function toggleGuestSave(itemType, itemId, item) {
  const all = await listGuestSaves();
  const i = all.findIndex((x) => x.itemType === itemType && x.itemId === itemId);
  if (i >= 0) {
    all.splice(i, 1);
    await write(SAVES_KEY, all);
    return false;
  }
  if (all.length >= GUEST_SAVE_LIMIT) {
    const err = new Error(`You can save up to ${GUEST_SAVE_LIMIT} items without an account. Sign in to save more.`);
    err.code = 'guest_limit';
    throw err;
  }
  all.unshift({ itemType, itemId, item: item || null, createdAt: Date.now() });
  await write(SAVES_KEY, all);
  return true;
}

/**
 * After sign-in: submit stored quiz results as real attempts (today's and
 * yesterday's quizzes only) and move saved items to the account.
 * Returns how many of each were moved.
 */
export async function claimGuestData() {
  const moved = { quizzes: 0, saves: 0 };
  const quizzes = Object.values(await read(QUIZ_KEY, {})).filter((q) => Date.now() - q.at < 2 * 86400000);
  for (const q of quizzes) {
    try {
      await api(`/quizzes/${q.quizId}/attempts`, { method: 'POST', body: { answers: q.answers, durationMs: q.durationMs } });
      moved.quizzes += 1;
    } catch { /* already attempted, or quiz gone */ }
  }
  await AsyncStorage.removeItem(QUIZ_KEY).catch(() => {});

  const saves = await listGuestSaves();
  const left = [];
  for (const s of [...saves].reverse()) {
    try {
      await api('/me/bookmarks', { method: 'POST', body: { itemType: s.itemType, itemId: s.itemId } });
      moved.saves += 1;
    } catch (err) {
      if (err.code === 'premium_required') left.unshift(s); // Account limit reached: keep on device.
    }
  }
  await write(SAVES_KEY, left);
  return moved;
}
