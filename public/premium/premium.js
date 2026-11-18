'use strict';
/* Web checkout for Premium (Razorpay). Opened from the app with a short-lived
   sign-in token in the URL fragment, or signed into directly with email/password.
   Everything is rendered as text, never HTML. */
const API = '/api/v1';
const app = document.getElementById('app');
let token = null;
let selected = 'yearly';

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) { const e = new Error(data.error?.message || `Request failed (${res.status})`); e.code = data.error?.code; e.status = res.status; throw e; }
  return data;
}

const fmtDate = (d) => new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
const FEATURES = ['Full archive of articles and daily quizzes', 'Unlimited practice by subject', 'Unlimited saved articles and questions', 'Read saved articles offline', 'Insights into your weak topics', 'AI tutor and audio briefings when they launch'];

function shell(...children) {
  app.replaceChildren(h('div', { class: 'brand' }, 'UNBOUND DAILY'), ...children);
}

function loginView(message) {
  const email = h('input', { type: 'email', autocomplete: 'username', id: 'email' });
  const password = h('input', { type: 'password', autocomplete: 'current-password', id: 'password' });
  const err = h('p', { class: 'error', role: 'alert' }, message || '');
  shell(
    h('h1', {}, 'Sign in to get Premium'),
    h('p', { class: 'muted' }, 'Use the account you use in the app. If you signed up with Google or Apple, open this page from the app instead (Profile → Premium).'),
    h('form', { onsubmit: async (e) => {
      e.preventDefault();
      try {
        const r = await api('/auth/login', { method: 'POST', body: { email: email.value, password: password.value } });
        token = r.token;
        await main();
      } catch (ex) { err.textContent = ex.message; }
    } }, h('label', { for: 'email' }, 'Email'), email, h('label', { for: 'password' }, 'Password'), password, err,
    h('button', { class: 'primary', type: 'submit' }, 'Continue')),
  );
}

function premiumView(status) {
  const p = status.premium;
  const sub = status.subscription;
  shell(
    h('h1', {}, 'You’re Premium'),
    h('p', { class: 'ok' }, p.status === 'cancelled' ? `Cancelled. Premium stays active until ${fmtDate(p.until)}.` : `Active until ${fmtDate(p.until)}${p.source === 'razorpay' ? ' and renews automatically' : ''}.`),
    h('ul', { class: 'features' }, FEATURES.map((f) => h('li', {}, f))),
    h('p', { class: 'muted' }, 'You can close this page and return to the app.'),
    sub && sub.status !== 'cancelled' && p.source === 'razorpay' ? h('button', { class: 'link', onclick: async () => {
      if (!confirm(`Cancel auto-renewal? You keep Premium until ${fmtDate(p.until)}.`)) return;
      try { await api('/billing/cancel', { method: 'POST' }); await main(); } catch (ex) { alert(ex.message); }
    } }, 'Cancel auto-renewal') : null,
  );
}

function buyView(plans, status) {
  const err = h('p', { class: 'error', role: 'alert' });
  const monthly = plans.plans.find((x) => x.id === 'monthly');
  const yearly = plans.plans.find((x) => x.id === 'yearly');
  const saving = monthly && yearly ? Math.round((1 - yearly.amount / (monthly.amount * 12)) * 100) : 0;
  const planButtons = plans.plans.map((pl) => h('button', {
    class: 'plan', type: 'button', 'aria-pressed': String(pl.id === selected),
    onclick: () => { selected = pl.id; buyView(plans, status); },
  },
  h('span', {}, h('strong', {}, pl.label), pl.id === 'yearly' && saving > 0 ? h('span', { class: 'save' }, `SAVE ${saving}%`) : null,
    h('div', { class: 'muted' }, pl.id === 'yearly' ? `${pl.display} per year (about ₹${Math.round(pl.amount / 1200)} a month)` : `${pl.display} per month`)),
  h('span', { class: 'price' }, pl.display)));

  const pay = h('button', { class: 'primary', onclick: async () => {
    err.textContent = '';
    pay.disabled = true;
    try {
      const s = await api('/billing/subscriptions', { method: 'POST', body: { plan: selected } });
      if (!window.Razorpay) throw new Error('Payment window could not load. Check your connection and try again.');
      const rzp = new window.Razorpay({
        key: s.keyId,
        subscription_id: s.subscriptionId,
        name: 'Unbound Daily Premium',
        description: `${s.plan.label} plan`,
        prefill: s.prefill,
        theme: { color: '#FF7928' },
        handler: async (resp) => {
          try { await api('/billing/verify', { method: 'POST', body: resp }); await main(); } catch (ex) { err.textContent = `${ex.message}. If you were charged, Premium will appear within a few minutes.`; }
        },
        modal: { ondismiss: () => { pay.disabled = false; } },
      });
      rzp.on('payment.failed', (r) => { err.textContent = r.error?.description || 'Payment failed. Please try again.'; pay.disabled = false; });
      rzp.open();
    } catch (ex) {
      err.textContent = ex.code === 'email_not_verified' ? 'Please verify your email in the app first (you’ll see a banner on the Today screen), then try again.' : ex.message;
      pay.disabled = false;
    }
  } }, `Continue with ${plans.plans.find((x) => x.id === selected)?.display || ''}`);

  shell(
    h('h1', {}, 'Get Premium'),
    h('p', { class: 'muted' }, 'Everything you need for current affairs preparation, without limits.'),
    h('ul', { class: 'features' }, FEATURES.map((f) => h('li', {}, f))),
    h('div', { class: 'plans', role: 'group', 'aria-label': 'Choose a plan' }, planButtons),
    pay, err,
    h('p', { class: 'fine' }, 'Secure payment by Razorpay: UPI, cards and net banking. Renews automatically; cancel any time from this page and keep Premium until the end of the period you paid for.'),
    status.premium.status === 'halted' ? h('p', { class: 'error' }, 'Your last renewal payment failed, so Premium is paused. Subscribe again to continue.') : null,
  );
}

async function main() {
  if (!token) return loginView();
  try {
    const [plans, status] = await Promise.all([api('/billing/plans'), api('/billing/status')]);
    if (!plans.enabled) return shell(h('h1', {}, 'Everything is free right now'), h('p', { class: 'muted' }, 'Premium isn’t switched on yet, so you already have every feature.'));
    if (!plans.purchaseAvailable.configured) return shell(h('h1', {}, 'Premium is coming soon'), h('p', { class: 'muted' }, 'Payments aren’t open yet. Please check back shortly.'));
    if (status.premium.active) return premiumView(status);
    return buyView(plans, status);
  } catch (ex) {
    if (ex.status === 401) { token = null; return loginView('Your link has expired. Open Premium again from the app, or sign in below.'); }
    return shell(h('h1', {}, 'Something went wrong'), h('p', { class: 'error' }, ex.message), h('button', { class: 'primary', onclick: main }, 'Try again'));
  }
}

// Take the sign-in token from the fragment and remove it from the address bar.
const m = location.hash.match(/t=([^&]+)/);
if (m) { token = decodeURIComponent(m[1]); history.replaceState(null, '', location.pathname); }
main();
