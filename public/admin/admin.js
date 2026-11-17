'use strict';
/* Admin panel: plain JavaScript, no build step. All content is rendered as text
   (never as HTML) because AI-generated and feed content is untrusted. */

const API = '/api/v1';
const app = document.getElementById('app');
let me = null;

// ---------- helpers ----------
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

function toast(msg) {
  const t = h('div', {}, msg);
  document.getElementById('toast').append(t);
  setTimeout(() => t.remove(), 4000);
}

function token() {
  try { return sessionStorage.getItem('token'); } catch { return null; }
}

async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token() ? { Authorization: `Bearer ${token()}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) { logout(); throw new Error('Please sign in again'); }
  if (!res.ok) {
    const fields = data.error?.details?.fieldErrors;
    const extra = fields && Object.keys(fields).length
      ? ` (${Object.entries(fields).map(([k, v]) => `${k}: ${v.join(', ')}`).join('; ')})`
      : '';
    throw new Error((data.error?.message || `Request failed (${res.status})`) + extra);
  }
  return data;
}

const fmt = (d) => (d ? new Date(d).toLocaleString('en-IN') : '—');
const badge = (s) => h('span', { class: `badge ${s}` }, s.replace('_', ' '));

async function guarded(fn) {
  try { await fn(); } catch (err) { toast(err.message); }
}

function logout() {
  try { sessionStorage.removeItem('token'); } catch { /* ignore */ }
  me = null;
  location.hash = '#/login';
  render();
}

// ---------- views ----------
function loginView() {
  const email = h('input', { type: 'email', autocomplete: 'username', required: true });
  const password = h('input', { type: 'password', autocomplete: 'current-password', required: true });
  const form = h('form', { class: 'panel login', onsubmit: (e) => {
    e.preventDefault();
    guarded(async () => {
      const r = await api('/auth/login', { method: 'POST', body: { email: email.value, password: password.value } });
      if (!['editor', 'admin'].includes(r.user.role)) throw new Error('This account is not an editor or admin');
      try { sessionStorage.setItem('token', r.token); } catch { /* ignore */ }
      location.hash = '#/review';
      render();
    });
  } },
  h('h1', {}, 'Sign in'), h('label', {}, 'Email'), email, h('label', {}, 'Password'), password,
  h('div', { class: 'row', style: 'margin-top:12px' }, h('button', { class: 'primary', type: 'submit' }, 'Sign in')));
  return form;
}

async function articleListView(status, title) {
  const qs = status ? `?status=${status}&limit=50` : '?limit=50';
  const { items, total } = await api(`/admin/articles${qs}`);
  return h('div', { class: 'panel' },
    h('h1', {}, `${title} (${total})`),
    items.length ? h('table', {},
      h('thead', {}, h('tr', {}, h('th', {}, 'Title'), h('th', {}, 'Status'), h('th', {}, 'Subjects'), h('th', {}, 'Facts'), h('th', {}, 'Source'), h('th', {}, 'Created'))),
      h('tbody', {}, items.map((a) => h('tr', {},
        h('td', {}, h('a', { href: `#/article/${a._id}` }, a.title)),
        h('td', {}, badge(a.status), a.version > 1 ? h('span', { class: 'muted' }, ` v${a.version}`) : null),
        h('td', { class: 'muted' }, (a.tags?.subjects || []).join(', ')),
        h('td', { class: 'muted' }, String(a.factsToVerify?.length || 0)),
        h('td', { class: 'muted' }, a.generation?.provider || '—'),
        h('td', { class: 'muted' }, fmt(a.createdAt)))))) : h('p', { class: 'muted' }, 'Nothing here.'));
}

function questionCard(q, article, reload) {
  const editing = h('div', { hidden: true });
  const stem = h('textarea', {}, q.stem);
  const options = q.options.map((o) => h('input', { value: o }));
  const correct = h('select', {}, q.options.map((_, i) => h('option', { value: i, selected: i === q.correctIndex }, `Option ${String.fromCharCode(65 + i)}`)));
  const explanation = h('textarea', {}, q.explanation);
  const note = h('input', { placeholder: 'Correction note (required for published questions)' });
  editing.append(
    h('label', {}, 'Question'), stem,
    h('label', {}, 'Options'), ...options,
    h('label', {}, 'Correct option'), correct,
    h('label', {}, 'Explanation'), explanation,
    q.status === 'published' ? note : null,
    h('div', { class: 'row', style: 'margin-top:8px' },
      h('button', { class: 'primary', onclick: () => guarded(async () => {
        await api(`/admin/questions/${q._id}`, { method: 'PATCH', body: {
          stem: stem.value, options: options.map((o) => o.value), correctIndex: Number(correct.value), explanation: explanation.value,
          ...(q.status === 'published' ? { correctionNote: note.value } : {}),
        } });
        toast('Question saved'); reload();
      }) }, 'Save'),
      h('button', { onclick: () => { editing.hidden = true; } }, 'Cancel')));

  const canEdit = !['rejected', 'retired'].includes(q.status) && !['rejected', 'retracted'].includes(article.status);
  return h('div', { class: 'q' },
    h('div', { class: 'row' }, badge(q.status), h('span', { class: 'muted' }, `${q.difficulty} · v${q.version}`)),
    h('p', {}, q.stem),
    h('ol', { type: 'A' }, q.options.map((o, i) => h('li', { class: i === q.correctIndex ? 'correct' : '' }, o))),
    h('p', { class: 'muted' }, 'Explanation: ', q.explanation),
    h('div', { class: 'row' },
      canEdit ? h('button', { onclick: () => { editing.hidden = false; } }, 'Edit') : null,
      canEdit ? h('button', { class: 'danger', onclick: () => guarded(async () => { await api(`/admin/questions/${q._id}/reject`, { method: 'POST' }); reload(); }) }, 'Reject question') : null,
      q.status === 'rejected' && article.status !== 'retracted' ? h('button', { onclick: () => guarded(async () => { await api(`/admin/questions/${q._id}/restore`, { method: 'POST' }); reload(); }) }, 'Restore') : null),
    editing);
}

async function articleView(id) {
  const { article: a, questions, revisions, history } = await api(`/admin/articles/${id}`);
  const reload = () => render();
  const inReview = ['in_review', 'draft'].includes(a.status);

  const factBoxes = a.factsToVerify.map((f, i) => h('input', { type: 'checkbox', 'data-i': i, checked: f.confirmed, disabled: !inReview }));
  const notes = h('textarea', { placeholder: 'Review notes (optional for approval, required to reject or retract)' });

  // Inline edit of the article text.
  const fields = {
    title: h('input', { value: a.title }),
    summary: h('textarea', {}, a.summary),
    body: h('textarea', { style: 'min-height:220px' }, a.body),
    upscRelevance: h('textarea', {}, a.upscRelevance || ''),
    keyPoints: h('textarea', {}, (a.keyPoints || []).join('\n')),
  };
  const correctionNote = h('input', { placeholder: 'What was corrected and why (shown to readers)' });
  const editForm = h('div', { hidden: true },
    ...Object.entries(fields).flatMap(([k, el]) => [h('label', {}, k === 'keyPoints' ? 'Key points (one per line)' : k), el]),
    a.status === 'published' ? [h('label', {}, 'Correction note'), correctionNote] : null,
    h('div', { class: 'row', style: 'margin-top:8px' },
      h('button', { class: 'primary', onclick: () => guarded(async () => {
        const body = {
          title: fields.title.value, summary: fields.summary.value, body: fields.body.value, upscRelevance: fields.upscRelevance.value,
          keyPoints: fields.keyPoints.value.split('\n').map((s) => s.trim()).filter(Boolean),
        };
        if (a.status === 'published') body.correctionNote = correctionNote.value;
        await api(`/admin/articles/${a._id}`, { method: 'PATCH', body });
        toast('Saved'); reload();
      }) }, 'Save changes'),
      h('button', { onclick: () => { editForm.hidden = true; } }, 'Cancel')));

  const actions = h('div', { class: 'row' },
    inReview ? h('button', { class: 'primary', onclick: () => guarded(async () => {
      const confirmedFacts = factBoxes.filter((b) => b.checked).map((b) => Number(b.dataset.i));
      const r = await api(`/admin/articles/${a._id}/approve`, { method: 'POST', body: { confirmedFacts, notes: notes.value || undefined } });
      toast(`Published with ${r.questionsPublished} questions`); reload();
    }) }, 'Approve & publish') : null,
    inReview ? h('button', { class: 'danger', onclick: () => guarded(async () => {
      await api(`/admin/articles/${a._id}/reject`, { method: 'POST', body: { reason: notes.value } }); toast('Rejected'); reload();
    }) }, 'Reject') : null,
    a.status === 'published' ? h('button', { class: 'danger', onclick: () => guarded(async () => {
      if (!confirm('Retract this article? Readers will see a retraction notice and its questions leave quizzes.')) return;
      await api(`/admin/articles/${a._id}/retract`, { method: 'POST', body: { reason: notes.value } }); toast('Retracted'); reload();
    }) }, 'Retract') : null,
    ['in_review', 'draft', 'published'].includes(a.status) ? h('button', { onclick: () => { editForm.hidden = false; } }, a.status === 'published' ? 'Correct' : 'Edit') : null);

  return h('div', {},
    h('p', {}, h('a', { href: '#/review' }, '← Review queue')),
    h('div', { class: 'panel' },
      h('div', { class: 'row' }, badge(a.status), h('span', { class: 'muted' }, `v${a.version} · ${a.tags.gsPaper} · ${(a.tags.subjects || []).join(', ')}`)),
      h('h1', {}, a.title),
      h('p', {}, h('strong', {}, 'Summary: '), a.summary),
      h('h2', {}, 'Explainer'), ...a.body.split('\n').filter(Boolean).map((p) => h('p', {}, p)),
      h('h2', {}, 'Key points'), h('ul', {}, (a.keyPoints || []).map((k) => h('li', {}, k))),
      h('h2', {}, 'Why it matters for UPSC'), h('p', {}, a.upscRelevance || '—'),
      editForm),
    h('div', { class: 'panel' },
      h('h1', {}, 'Verify against sources'),
      h('ul', {}, a.sources.map((s) => h('li', {},
        h('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer' }, s.title || s.url),
        h('span', { class: 'muted' }, ` — ${s.publisher || ''} ${s.publishedAt ? `(${fmt(s.publishedAt)})` : ''}`),
        s.excerpt ? h('pre', {}, s.excerpt) : null))),
      h('h2', {}, `Flagged facts (${a.factsToVerify.length}) — tick each one after checking it`),
      a.factsToVerify.length ? h('ul', { class: 'facts' }, a.factsToVerify.map((f, i) => h('li', {}, h('label', { style: 'font-weight:400' }, factBoxes[i], f.text)))) : h('p', { class: 'muted' }, 'No facts flagged.'),
      h('label', {}, 'Notes'), notes,
      h('div', { style: 'margin-top:12px' }, actions),
      a.retraction?.reason ? h('p', { class: 'muted' }, `Retracted: ${a.retraction.reason}`) : null,
      a.review?.notes ? h('p', { class: 'muted' }, `Review notes: ${a.review.notes}`) : null),
    h('div', { class: 'panel' }, h('h1', {}, `Questions (${questions.length})`), questions.map((q) => questionCard(q, a, reload))),
    h('div', { class: 'panel' },
      h('h1', {}, 'Provenance & history'),
      h('p', { class: 'muted' }, `Generated by ${a.generation?.provider || '—'} ${a.generation?.model || ''} · prompt ${a.generation?.promptVersion || '—'} · ${fmt(a.generation?.generatedAt)}`),
      revisions.length ? h('p', { class: 'muted' }, 'Published versions: ', revisions.map((r) => `v${r.version} (${r.reason || ''})`).join(', ')) : null,
      h('ul', {}, history.map((e) => h('li', { class: 'muted' }, `${fmt(e.createdAt)} — ${e.actor?.name || 'unknown'}: ${e.action}`))),
      a.generation?.rawOutput ? h('details', {}, h('summary', {}, 'Raw AI output'), h('pre', {}, a.generation.rawOutput)) : null));
}

function newArticleView() {
  const f = {
    title: h('input'), summary: h('textarea'), body: h('textarea', { style: 'min-height:200px' }),
    upscRelevance: h('textarea'), keyPoints: h('textarea', { placeholder: 'One per line' }),
    gsPaper: h('select', {}, ['GS1', 'GS2', 'GS3', 'GS4', 'PRELIMS'].map((p) => h('option', {}, p))),
    subjects: h('input', { placeholder: 'e.g. polity, governance' }),
    sourceUrl: h('input', { type: 'url', placeholder: 'https://…' }), sourcePublisher: h('input'),
    facts: h('textarea', { placeholder: 'One checkable claim per line' }),
  };
  return h('div', { class: 'panel' },
    h('h1', {}, 'Write an article'),
    h('p', { class: 'muted' }, 'Hand-written articles go to the review queue like generated ones. Add questions from the article page after saving.'),
    ...Object.entries(f).flatMap(([k, el]) => [h('label', {}, k), el]),
    h('div', { class: 'row', style: 'margin-top:12px' }, h('button', { class: 'primary', onclick: () => guarded(async () => {
      const lines = (s) => s.split('\n').map((x) => x.trim()).filter(Boolean);
      const r = await api('/admin/articles', { method: 'POST', body: {
        title: f.title.value, summary: f.summary.value, body: f.body.value, upscRelevance: f.upscRelevance.value,
        keyPoints: lines(f.keyPoints.value),
        tags: { gsPaper: f.gsPaper.value, subjects: f.subjects.value.split(',').map((s) => s.trim()).filter(Boolean) },
        sources: [{ url: f.sourceUrl.value, publisher: f.sourcePublisher.value || undefined }],
        factsToVerify: lines(f.facts.value),
      } });
      location.hash = `#/article/${r.article._id}`;
    }) }, 'Save to review queue')));
}

async function quizzesView() {
  const { items } = await api('/admin/quizzes?limit=30');
  return h('div', { class: 'panel' },
    h('h1', {}, 'Quizzes'),
    h('p', { class: 'muted' }, 'The daily quiz is built automatically from newly published questions by the daily-quiz job.'),
    h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Title'), h('th', {}, 'Type'), h('th', {}, 'Questions'), h('th', {}, 'Status'), h('th', {}, 'Published'), h('th', {}))),
      h('tbody', {}, items.map((q) => h('tr', {},
        h('td', {}, q.title), h('td', {}, q.type), h('td', {}, String(q.questions.length)), h('td', {}, badge(q.status)), h('td', { class: 'muted' }, fmt(q.publishedAt)),
        h('td', {}, q.status === 'draft' ? h('button', { onclick: () => guarded(async () => { await api(`/admin/quizzes/${q._id}/publish`, { method: 'POST' }); render(); }) }, 'Publish') : null))))));
}

async function pipelineView() {
  const [dash, runs, failed] = await Promise.all([api('/admin/dashboard'), api('/admin/jobs/runs?limit=20'), api('/admin/raw-items?status=failed&limit=20')]);
  const isAdmin = me.role === 'admin';
  const counts = (o) => Object.entries(o).map(([k, v]) => `${k.replace('_', ' ')}: ${v}`).join(' · ') || '—';
  return h('div', {},
    h('div', { class: 'panel' },
      h('h1', {}, 'Content status'),
      h('p', {}, h('strong', {}, 'Feed items: '), counts(dash.rawItems)),
      h('p', {}, h('strong', {}, 'Articles: '), counts(dash.articles)),
      h('p', {}, h('strong', {}, 'Questions: '), counts(dash.questions))),
    h('div', { class: 'panel' },
      h('h1', {}, 'Jobs'),
      h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Job'), h('th', {}, 'Schedule (IST)'), h('th', {}, 'Last run'), h('th', {}))),
        h('tbody', {}, dash.jobs.map((j) => h('tr', {},
          h('td', {}, j.name), h('td', { class: 'muted' }, j.schedule),
          h('td', {}, j.lastRun ? [badge(j.lastRun.status), h('span', { class: 'muted' }, ` ${fmt(j.lastRun.startedAt)}`)] : h('span', { class: 'muted' }, 'never')),
          h('td', {}, isAdmin ? h('button', { onclick: () => guarded(async () => { await api(`/admin/jobs/${j.name}/run`, { method: 'POST' }); toast(`${j.name} started`); }) }, 'Run now') : null))))),
      h('h2', {}, 'Recent runs'),
      h('table', {}, h('tbody', {}, runs.items.map((r) => h('tr', {},
        h('td', {}, r.name), h('td', {}, badge(r.status)), h('td', { class: 'muted' }, fmt(r.startedAt)),
        h('td', { class: 'muted' }, r.durationMs != null ? `${Math.round(r.durationMs / 1000)}s` : ''),
        h('td', {}, h('pre', {}, r.error ? r.error.split('\n')[0] : JSON.stringify(r.stats || {})))))))),
    h('div', { class: 'panel' },
      h('h1', {}, `Failed feed items (${failed.total})`),
      failed.items.length ? h('table', {}, h('tbody', {}, failed.items.map((i) => h('tr', {},
        h('td', {}, h('a', { href: i.url, target: '_blank', rel: 'noopener noreferrer' }, i.title)),
        h('td', { class: 'muted' }, i.lastError || ''),
        h('td', {}, isAdmin ? h('button', { onclick: () => guarded(async () => { await api(`/admin/raw-items/${i._id}/retry`, { method: 'POST' }); render(); }) }, 'Retry') : null))))) : h('p', { class: 'muted' }, 'None.')));
}

async function auditView() {
  const { items } = await api('/admin/audit?limit=50');
  return h('div', { class: 'panel' }, h('h1', {}, 'Audit log'),
    h('table', {}, h('tbody', {}, items.map((e) => h('tr', {},
      h('td', { class: 'muted' }, fmt(e.createdAt)), h('td', {}, e.actor?.name || '—'), h('td', {}, e.action),
      h('td', {}, e.entityType === 'Article' ? h('a', { href: `#/article/${e.entityId}` }, 'article') : e.entityType),
      h('td', { class: 'muted' }, e.details ? JSON.stringify(e.details) : ''))))));
}

// ---------- router ----------
async function render() {
  const hash = location.hash || '#/review';
  if (!token()) {
    document.getElementById('nav').hidden = true;
    document.getElementById('who').textContent = '';
    app.replaceChildren(loginView());
    return;
  }
  if (!me) {
    try { me = (await api('/auth/me')).user; } catch { return; }
  }
  document.getElementById('nav').hidden = false;
  document.getElementById('who').replaceChildren(`${me.name} (${me.role}) `, h('button', { onclick: logout }, 'Sign out'));

  app.replaceChildren(h('p', { class: 'muted' }, 'Loading…'));
  try {
    const [, route, id] = hash.split('/');
    let view;
    if (route === 'article' && id) view = await articleView(id);
    else if (route === 'articles') view = await articleListView('', 'All content');
    else if (route === 'new') view = newArticleView();
    else if (route === 'quizzes') view = await quizzesView();
    else if (route === 'pipeline') view = await pipelineView();
    else if (route === 'audit') view = await auditView();
    else view = await articleListView('in_review', 'Review queue');
    app.replaceChildren(view);
  } catch (err) {
    app.replaceChildren(h('div', { class: 'panel' }, h('p', {}, err.message)));
  }
}

window.addEventListener('hashchange', render);
render();
