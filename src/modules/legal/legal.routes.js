'use strict';
const express = require('express');
const config = require('../../config');
const content = require('./content');

/**
 * Public website pages: home, privacy policy, terms, refunds, contact and web account
 * deletion. Plain server-rendered HTML in English (default) or Hindi (?lang=hi).
 * The Play Store, App Store and Razorpay link to these.
 */

const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

/** Legal settings that must be filled in before launch (shown highlighted while empty). */
const REQUIRED = { operator: 'LEGAL_OPERATOR', contactEmail: 'LEGAL_CONTACT_EMAIL', grievanceOfficer: 'GRIEVANCE_OFFICER', address: 'LEGAL_ADDRESS', city: 'LEGAL_CITY' };

function values(ui) {
  const l = config.legal;
  const val = (key) => (l[key] ? esc(l[key]) : `<mark>[${ui.notSet}: ${REQUIRED[key]}]</mark>`);
  const email = l.contactEmail ? `<a href="mailto:${esc(l.contactEmail)}">${esc(l.contactEmail)}</a>` : val('contactEmail');
  return {
    app: esc(l.appName),
    operator: val('operator'),
    email,
    officer: val('grievanceOfficer'),
    address: val('address'),
    city: val('city'),
    date: esc(l.effectiveDate),
    base: esc(config.publicUrl || ''),
    storeLink: config.app.storeUrl
      ? `<a class="btn" href="${esc(config.app.storeUrl)}">Google Play</a>`
      : (ui === content.hi.ui ? 'जल्द ही Google Play पर।' : 'Coming soon to Google Play.'),
  };
}

const CSS = `
:root{--bg:#F5F2EC;--fg:#151515;--muted:#777777;--line:#E2DDD3;--accent:#FF7928;--card:#FFFFFF}
@media (prefers-color-scheme:dark){:root{--bg:#151515;--fg:#F5F2EC;--muted:#A3A3A3;--line:#2E2E2E;--card:#1E1E1E}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Noto Sans Devanagari","Noto Sans",sans-serif}
header,main,footer{max-width:760px;margin:0 auto;padding:0 16px}
header{display:flex;align-items:center;justify-content:space-between;padding-top:20px;padding-bottom:12px;border-bottom:1px solid var(--line)}
.brand{font-weight:800;letter-spacing:.08em;text-decoration:none;color:var(--fg)}
.brand span{color:var(--accent)}
a{color:var(--accent)}
h1{font-size:2rem;line-height:1.2;margin:32px 0 8px}
h2{font-size:1.15rem;margin:28px 0 6px}
.lead{color:var(--muted);font-size:1.05rem}
li{margin:6px 0}
mark{background:#FFE3CF;color:#151515;padding:0 4px;border-radius:3px}
nav{display:flex;flex-wrap:wrap;gap:6px 16px;padding:24px 0}
footer{color:var(--muted);font-size:.9rem;border-top:1px solid var(--line);padding-bottom:32px}
.note{font-size:.9rem;color:var(--muted)}
.btn,button{display:inline-block;background:var(--fg);color:var(--bg);border:0;border-radius:10px;padding:12px 18px;font:inherit;font-weight:700;text-decoration:none;cursor:pointer}
button.danger{background:#B42318;color:#fff}
button:disabled{opacity:.5;cursor:default}
form{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px;margin:28px 0}
label{display:block;font-weight:600;margin:12px 0 4px}
input{width:100%;font:inherit;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--bg);color:var(--fg)}
.row{margin-top:14px}
#msg{margin-top:12px;font-weight:600}
`;

function renderSections(sections) {
  return sections.map((s) => [
    `<h2>${s.h}</h2>`,
    ...(s.p || []).map((p) => `<p>${p}</p>`),
    s.ul ? `<ul>${s.ul.map((li) => `<li>${li}</li>`).join('')}</ul>` : '',
    ...(s.p2 || []).map((p) => `<p>${p}</p>`),
  ].join('')).join('\n');
}

function deletionForm(f, lang) {
  // Behaviour lives in /legal/delete.js (the site's CSP blocks inline scripts).
  return `<form id="del" data-lang="${lang}" data-sent="${esc(f.sent)}" data-done="${esc(f.done)}" data-failed="${esc(f.failed)}" novalidate>
  <label for="email">${f.email}</label>
  <input id="email" name="email" type="email" autocomplete="email" required>
  <div class="row"><button type="button" id="send">${f.send}</button></div>
  <div id="step2" hidden>
    <label for="code">${f.code}</label>
    <input id="code" name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="one-time-code">
    <p class="note">${f.warn}</p>
    <button type="button" id="confirm" class="danger">${f.confirm}</button>
  </div>
  <p id="msg" role="status" aria-live="polite"></p>
</form>
<script src="/legal/delete.js" defer></script>`;
}

function page(name, req) {
  const lang = req.query.lang === 'hi' ? 'hi' : 'en';
  const pack = content[lang];
  const v = values(pack.ui);
  const doc = pack[name](v);
  const q = lang === 'hi' ? '?lang=hi' : '';
  const path = name === 'home' ? '/' : name === 'deleteAccount' ? '/delete-account' : `/${name}`;
  const nav = Object.entries(pack.ui.nav).map(([k, label]) => `<a href="${k === 'deleteAccount' ? '/delete-account' : `/${k}`}${q}">${label}</a>`).join('');
  const other = lang === 'hi' ? path : `${path}?lang=hi`;
  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name === 'home' ? v.app : `${doc.title} · ${v.app}`}</title>
<meta name="description" content="${esc(doc.lead.replace(/<[^>]+>/g, ''))}">
<style>${CSS}</style>
</head>
<body>
<header><a class="brand" href="/${q}">UNBOUND <span>DAILY</span></a><a href="${other}" hreflang="${lang === 'hi' ? 'en' : 'hi'}">${pack.ui.lang}</a></header>
<main>
<h1>${doc.title}</h1>
<p class="lead">${doc.lead}</p>
${pack.ui.binding && name !== 'home' ? `<p class="note">${pack.ui.binding}</p>` : ''}
${doc.form ? deletionForm(pack.ui.form, lang) : ''}
${renderSections(doc.sections)}
</main>
<footer><nav>${nav}</nav>© ${new Date().getFullYear()} ${v.operator}</footer>
</body>
</html>`;
}

const router = express.Router();
const send = (name) => (req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.type('html').send(page(name, req));
};
router.get('/', send('home'));
router.get('/privacy', send('privacy'));
router.get('/terms', send('terms'));
router.get('/refunds', send('refunds'));
router.get('/contact', send('contact'));
router.get('/delete-account', send('deleteAccount'));

/** Which required legal settings are still empty (used by `npm run check:prod`). */
const missingLegal = () => Object.entries(REQUIRED).filter(([k]) => !config.legal[k]).map(([, env]) => env);

module.exports = { router, missingLegal };
