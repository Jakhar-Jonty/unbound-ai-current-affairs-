const dateFmt = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
const longFmt = new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Kolkata' });

export const formatDate = (d) => (d ? dateFmt.format(new Date(d)) : '');
export const formatLongDate = (d = new Date()) => longFmt.format(new Date(d));

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
