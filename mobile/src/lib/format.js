import { getApiLang } from './api';

// Dates follow the app language (Hindi month and day names, Latin digits).
const fmts = {};
function fmt(kind, lang) {
  const key = `${kind}:${lang}`;
  if (!fmts[key]) {
    const locale = lang === 'hi' ? 'hi-IN' : 'en-IN';
    const opts = kind === 'long'
      ? { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata', numberingSystem: 'latn' }
      : { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata', numberingSystem: 'latn' };
    fmts[key] = new Intl.DateTimeFormat(locale, opts);
  }
  return fmts[key];
}

export const formatDate = (d, lang = getApiLang()) => (d ? fmt('short', lang).format(new Date(d)) : '');
export const formatLongDate = (d = new Date(), lang = getApiLang()) => fmt('long', lang).format(new Date(d));

/** Compares dotted versions: returns -1, 0 or 1. */
export function compareVersions(a = '0', b = '0') {
  const pa = String(a).split('.').map((n) => Number.parseInt(n, 10) || 0);
  const pb = String(b).split('.').map((n) => Number.parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

export const optionLetter = (i) => String.fromCharCode(65 + i);

/** Same rule as the server: "Priya Sharma" -> "Priya S." */
export function shortName(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'Aspirant';
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}
