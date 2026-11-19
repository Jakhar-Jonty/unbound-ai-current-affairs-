import Constants from 'expo-constants';

/**
 * In development, the API runs on the same computer as the bundler (Metro). The app
 * already knows that computer's address (hostUri, e.g. "10.232.137.199:8081"), so the
 * API is reached there on port 4000. This follows the computer's current IP when you
 * change Wi-Fi, and works on phones and emulators alike.
 */
function devApiUrl() {
  if (!__DEV__) return null;
  // Web has no hostUri: use the page's own host. Never fall through to the production URL in development.
  const host = Constants.expoConfig?.hostUri?.split(':')[0] || globalThis.location?.hostname || 'localhost';
  return `http://${host}:${process.env.EXPO_PUBLIC_API_PORT || 4000}`;
}

/** Backend URL: EXPO_PUBLIC_API_URL if set, else (in development) the Metro host, else app.json extra.apiUrl. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || devApiUrl() || Constants.expoConfig?.extra?.apiUrl || 'http://localhost:4000').replace(/\/$/, '');

if (__DEV__) console.log(`[api] Using backend ${API_URL}`);

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
    throw new ApiError(0, 'network', __DEV__
      ? `Can’t reach the server at ${API_URL}. Is the backend running, and is this device on the same network?`
      : 'Can’t reach the server. Check your connection and try again.');
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
