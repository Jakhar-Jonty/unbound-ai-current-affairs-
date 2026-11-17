import Constants from 'expo-constants';

/** Backend URL: EXPO_PUBLIC_API_URL, else app.json extra.apiUrl. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || Constants.expoConfig?.extra?.apiUrl || 'http://localhost:4000').replace(/\/$/, '');

let authToken = null;
let contentLang = 'en';

/** Language for article and question text ('en' or 'hi'); sent as ?lang= on every request. */
export function setApiLang(lang) { contentLang = lang === 'hi' ? 'hi' : 'en'; }
export function getApiLang() { return contentLang; }
let onUnauthorized = null;

export function setAuthToken(token) { authToken = token; }
export function setUnauthorizedHandler(fn) { onUnauthorized = fn; }

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Calls the v1 API. Throws ApiError with the server's message on failure. */
export async function api(path, { method = 'GET', body, signal, lang = contentLang } = {}) {
  let res;
  const url = lang === 'hi' ? `${path}${path.includes('?') ? '&' : '?'}lang=hi` : path;
  try {
    res = await fetch(`${API_URL}/api/v1${url}`, {
      method,
      signal,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err?.name === 'AbortError') throw err;
    throw new ApiError(0, 'network', 'Can’t reach the server. Check your connection and try again.');
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && authToken) onUnauthorized?.();
    const e = data.error || {};
    throw new ApiError(res.status, e.code || 'error', e.message || `Request failed (${res.status})`, e.details);
  }
  return data;
}
