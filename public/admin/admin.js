'use strict';
/* Admin panel: plain JavaScript, no build step. All content is rendered as text
   (never as HTML) because AI-generated and feed content is untrusted. */

const API = '/api/v1';
const app = document.getElementById('app');
let me = null;

// ---------- helpers ----------
// Exams an article can be tagged for (same keys as src/modules/taxonomy/taxonomy.js).
const EXAMS = { upsc: 'UPSC', 'state-psc': 'State PSC', ssc: 'SSC', railways: 'Railways', banking: 'Banking', insurance: 'Insurance', defence: 'Defence' };
const examLabels = (keys) => (keys && keys.length ? keys.map((k) => EXAMS[k] || k).join(', ') : 'all exams (untagged)');

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

/** Auto-publish switch. Shown on the review queue and the Pipeline page; only admins can change it. */
async function autoPublishPanel() {
  const { settings } = await api('/admin/settings');
  const on = !!settings.autoPublish;
  const isAdmin = me.role === 'admin';
  return h('div', { class: on ? 'panel notice' : 'panel' },
    h('div', { class: 'row', style: 'justify-content:space-between;align-items:center' },
      h('div', {},
        h('strong', {}, `Auto-publish is ${on ? 'ON' : 'OFF'}`),
        h('div', { class: 'muted' }, on
          ? 'New AI articles, their questions and Hindi translations that pass the automatic checks go live straight away. Spot-check them under Published; correct or retract anything wrong.'
          : 'New AI articles wait here until an editor approves them. Hindi waits in the Hindi tab.')),
      isAdmin ? h('button', { class: on ? 'danger' : 'primary', onclick: () => guarded(async () => {
        if (on && !confirm('Turn auto-publish OFF? New articles will wait for an editor to approve them.')) return;
        if (!on && !confirm('Turn auto-publish ON? New AI articles will go live without an editor checking them.')) return;
        await api('/admin/settings', { method: 'PATCH', body: { autoPublish: !on } });
        toast(`Auto-publish ${on ? 'off' : 'on'}`); reload();
      }) }, on ? 'Turn off' : 'Turn on') : h('span', { class: 'muted' }, 'Only admins can change this')));
}

async function articleListView(status, title) {
  const qs = status ? `?status=${status}&limit=50` : '?limit=50';
  const [{ items, total }, autoPanel] = await Promise.all([api(`/admin/articles${qs}`), status === 'in_review' ? autoPublishPanel() : null]);
  const publishAll = status === 'in_review' && total > 0 && me.role === 'admin'
    ? h('button', { class: 'primary', onclick: () => guarded(async () => {
      if (!confirm(`Publish all ${total} waiting articles now, with their questions? They go live without an editor review. Hindi follows on the next translation run.`)) return;
      const r = await api('/admin/articles/publish-waiting', { method: 'POST' });
      toast(`Published ${r.published} articles and ${r.questions} questions${r.skipped ? `; ${r.skipped} need a source or question first` : ''}`);
      reload();
    }) }, `Publish all waiting (${total})`)
    : null;
  return h('div', {}, autoPanel, h('div', { class: 'panel' },
    h('div', { class: 'row', style: 'justify-content:space-between;align-items:center' }, h('h1', {}, `${title} (${total})`), publishAll),
    items.length ? h('table', {},
      h('thead', {}, h('tr', {}, h('th', {}, 'Title'), h('th', {}, 'Status'), h('th', {}, 'Subjects'), h('th', {}, 'Facts'), h('th', {}, 'Sources'), h('th', {}, 'Written by'), h('th', {}, 'Created'))),
      h('tbody', {}, items.map((a) => h('tr', {},
        h('td', {}, h('a', { href: `#/article/${a._id}` }, a.title)),
        h('td', {}, badge(a.status), a.review?.auto ? h('span', { class: 'muted', title: 'Published automatically, not reviewed by an editor' }, ' auto') : null, a.version > 1 ? h('span', { class: 'muted' }, ` v${a.version}`) : null),
        h('td', { class: 'muted' }, (a.tags?.subjects || []).join(', ')),
        h('td', { class: 'muted' }, String(a.factsToVerify?.length || 0)),
        h('td', { class: 'muted' }, String(a.sources?.length || 0)),
        h('td', { class: 'muted' }, a.generation?.provider || '—'),
        h('td', { class: 'muted' }, fmt(a.createdAt)))))) : h('p', { class: 'muted' }, 'Nothing here.')));
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
  const { article: a, questions, revisions, history, hindi } = await api(`/admin/articles/${id}`);
  const reload = () => render();
  const inReview = ['in_review', 'draft'].includes(a.status);
  const similar = inReview ? (await api(`/admin/articles/${id}/similar`)).items : [];
  const lateSources = a.sources.filter((s) => s.addedLater);

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
  const examsEdit = examPicker(a.tags.exams || []);
  const correctionNote = h('input', { placeholder: 'What was corrected and why (shown to readers)' });
  const editForm = h('div', { hidden: true },
    ...Object.entries(fields).flatMap(([k, el]) => [h('label', {}, k === 'keyPoints' ? 'Key points (one per line)' : k === 'upscRelevance' ? 'Why it matters for exams' : k), el]),
    h('label', {}, 'Exams'), examsEdit,
    a.status === 'published' ? [h('label', {}, 'Correction note (only if you change the text; not needed for exams)'), correctionNote] : null,
    h('div', { class: 'row', style: 'margin-top:8px' },
      h('button', { class: 'primary', onclick: () => guarded(async () => {
        // Send only what changed. Changing only the exams isn't a correction: no note,
        // no new version, and the Hindi translation stays published.
        const edited = {
          title: fields.title.value, summary: fields.summary.value, body: fields.body.value, upscRelevance: fields.upscRelevance.value,
          keyPoints: fields.keyPoints.value.split('\n').map((s) => s.trim()).filter(Boolean),
        };
        const original = { title: a.title, summary: a.summary, body: a.body, upscRelevance: a.upscRelevance || '', keyPoints: a.keyPoints || [] };
        const body = {};
        for (const [k, v] of Object.entries(edited)) if (JSON.stringify(v) !== JSON.stringify(original[k])) body[k] = v;
        const textChanged = Object.keys(body).length > 0;
        const exams = examsEdit.value();
        if (!exams.length) throw new Error('Tick at least one exam');
        if (exams.join() !== (a.tags.exams || []).join()) body.tags = { exams };
        if (!Object.keys(body).length) { toast('Nothing changed'); return; }
        if (a.status === 'published' && textChanged) {
          if (!correctionNote.value.trim()) throw new Error('Text changed: add a correction note (shown to readers)');
          body.correctionNote = correctionNote.value;
        }
        await api(`/admin/articles/${a._id}`, { method: 'PATCH', body });
        toast(textChanged ? 'Saved' : 'Exams updated'); reload();
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
      h('div', { class: 'row' }, badge(a.status), h('span', { class: 'muted' }, `v${a.version} · ${examLabels(a.tags.exams)} · ${a.tags.gsPaper} · ${(a.tags.subjects || []).join(', ')}`)),
      h('h1', {}, a.title),
      h('p', {}, h('strong', {}, 'Summary: '), a.summary),
      h('h2', {}, 'Explainer'), ...a.body.split('\n').filter(Boolean).map((p) => h('p', {}, p)),
      h('h2', {}, 'Key points'), h('ul', {}, (a.keyPoints || []).map((k) => h('li', {}, k))),
      h('h2', {}, 'Why it matters for exams'), h('p', {}, a.upscRelevance || '—'),
      editForm),
    a.mergedInto ? h('div', { class: 'panel notice' }, 'This was a duplicate and was merged into ', h('a', { href: `#/article/${a.mergedInto}` }, 'another article'), '.') : null,
    inReview && lateSources.length ? h('div', { class: 'panel notice' },
      h('strong', {}, `${lateSources.length} more ${lateSources.length === 1 ? 'outlet' : 'outlets'} covered this story after it was written. `),
      'Check their reports (marked “added later” below) and update the explainer if they add or contradict anything.') : null,
    similar.length ? h('div', { class: 'panel' },
      h('h1', {}, 'Possible duplicates'),
      h('p', { class: 'muted' }, 'Other recent articles that look like the same event. Merging moves this article’s sources, flagged facts and questions into the other one and rejects this one.'),
      h('table', {}, h('tbody', {}, similar.map((d) => h('tr', {},
        h('td', {}, h('a', { href: `#/article/${d._id}` }, d.title), h('div', { class: 'muted' }, `${d.publishers.join(', ') || '—'} · ${fmt(d.createdAt)}`)),
        h('td', {}, badge(d.status)),
        h('td', { class: 'muted' }, `${Math.round(d.score * 100)}% similar`),
        h('td', {}, ['in_review', 'draft'].includes(d.status)
          ? h('button', { onclick: () => guarded(async () => {
            if (!confirm(`Merge this article into “${d.title}”?`)) return;
            const r = await api(`/admin/articles/${a._id}/merge`, { method: 'POST', body: { intoId: d._id } });
            toast(`Merged. ${r.questionsMoved} questions moved.`);
            location.hash = `#/article/${d._id}`;
          }) }, 'Merge into this')
          : h('span', { class: 'muted' }, d.status === 'published' ? 'Already published: reject this one instead' : ''))))))) : null,
    h('div', { class: 'panel' },
      h('h1', {}, `Verify against sources (${a.sources.length})`),
      h('ul', {}, a.sources.map((s) => h('li', {},
        h('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer' }, s.title || s.url),
        h('span', { class: 'muted' }, ` — ${s.publisher || ''} ${s.publishedAt ? `(${fmt(s.publishedAt)})` : ''}`),
        s.addedLater ? h('span', { class: 'badge in_review', style: 'margin-left:6px' }, 'added later') : null,
        s.excerpt ? h('pre', {}, s.excerpt) : null))),
      h('h2', {}, `Flagged facts (${a.factsToVerify.length}) — tick each one after checking it`),
      a.factsToVerify.length ? h('ul', { class: 'facts' }, a.factsToVerify.map((f, i) => h('li', {}, h('label', { style: 'font-weight:400' }, factBoxes[i], f.text)))) : h('p', { class: 'muted' }, 'No facts flagged.'),
      h('label', {}, 'Notes'), notes,
      h('div', { style: 'margin-top:12px' }, actions),
      a.retraction?.reason ? h('p', { class: 'muted' }, `Retracted: ${a.retraction.reason}`) : null,
      a.review?.notes ? h('p', { class: 'muted' }, `Review notes: ${a.review.notes}`) : null),
    a.status === 'published' ? hindiPanel(a, questions.filter((q) => q.status === 'published'), hindi, reload) : null,
    h('div', { class: 'panel' }, h('h1', {}, `Questions (${questions.length})`), questions.map((q) => questionCard(q, a, reload))),
    h('div', { class: 'panel' },
      h('h1', {}, 'Provenance & history'),
      h('p', { class: 'muted' }, `Generated by ${a.generation?.provider || '—'} ${a.generation?.model || ''} · prompt ${a.generation?.promptVersion || '—'} · ${fmt(a.generation?.generatedAt)}`),
      revisions.length ? h('p', { class: 'muted' }, 'Published versions: ', revisions.map((r) => `v${r.version} (${r.reason || ''})`).join(', ')) : null,
      h('ul', {}, history.map((e) => h('li', { class: 'muted' }, `${fmt(e.createdAt)} — ${e.actor?.name || 'unknown'}: ${e.action}`))),
      a.generation?.rawOutput ? h('details', {}, h('summary', {}, 'Raw AI output'), h('pre', {}, a.generation.rawOutput)) : null));
}

/** Row of exam checkboxes; `.value()` returns the ticked keys. */
function examPicker(selected = []) {
  const boxes = Object.entries(EXAMS).map(([k, label]) => {
    const box = h('input', { type: 'checkbox', checked: selected.includes(k), 'data-k': k });
    return h('label', { style: 'display:inline-flex;gap:4px;margin-right:12px;font-weight:normal' }, box, label);
  });
  const el = h('div', {}, ...boxes);
  el.value = () => boxes.map((l) => l.querySelector('input')).filter((b) => b.checked).map((b) => b.dataset.k);
  return el;
}

function newArticleView() {
  const f = {
    title: h('input'), summary: h('textarea'), body: h('textarea', { style: 'min-height:200px' }),
    upscRelevance: h('textarea'), keyPoints: h('textarea', { placeholder: 'One per line' }),
    gsPaper: h('select', {}, ['GS1', 'GS2', 'GS3', 'GS4', 'PRELIMS'].map((p) => h('option', {}, p))),
    subjects: h('input', { placeholder: 'e.g. polity, governance' }),
    exams: examPicker(['upsc', 'state-psc']),
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
        tags: { exams: f.exams.value(), gsPaper: f.gsPaper.value, subjects: f.subjects.value.split(',').map((s) => s.trim()).filter(Boolean) },
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

const HINDI_STATE = { missing: 'not translated', outdated: 'outdated (English changed)', in_review: 'waiting for review', published: 'published' };

/** Hindi review: English and Hindi side by side, editable, then publish. */
function hindiPanel(a, questions, hindi, reload) {
  const t = a.translations?.hi;
  const current = hindi.article === 'in_review' || hindi.article === 'published';
  const field = (label, en, el) => h('div', { class: 'pair' },
    h('div', {}, h('label', {}, `${label} (English)`), h('div', { class: 'en' }, en || '—')),
    h('div', {}, h('label', {}, `${label} (हिंदी)`), el));
  const f = current ? {
    title: h('input', { value: t.title, lang: 'hi' }),
    summary: h('textarea', { lang: 'hi' }, t.summary),
    body: h('textarea', { lang: 'hi', style: 'min-height:220px' }, t.body),
    keyPoints: h('textarea', { lang: 'hi' }, (t.keyPoints || []).join('\n')),
    upscRelevance: h('textarea', { lang: 'hi' }, t.upscRelevance || ''),
  } : null;
  const waiting = hindi.article === 'in_review' || hindi.questions.some((q) => q.state === 'in_review');

  const qBlocks = questions.map((q) => {
    const state = hindi.questions.find((x) => x.id === q._id)?.state || 'missing';
    const qt = q.translations?.hi;
    if (!(state === 'in_review' || state === 'published')) {
      return h('div', { class: 'q' }, h('p', { class: 'muted' }, `Question: Hindi ${HINDI_STATE[state]}`), h('p', {}, q.stem));
    }
    const stem = h('textarea', { lang: 'hi' }, qt.stem);
    const opts = qt.options.map((o) => h('input', { value: o, lang: 'hi' }));
    const expl = h('textarea', { lang: 'hi' }, qt.explanation);
    return h('div', { class: 'q' },
      h('div', { class: 'row' }, badge(state), h('span', { class: 'muted' }, `Correct answer: ${String.fromCharCode(65 + q.correctIndex)}`)),
      field('Question', q.stem, stem),
      ...q.options.map((o, i) => field(`Option ${String.fromCharCode(65 + i)}`, o, opts[i])),
      field('Explanation', q.explanation, expl),
      h('button', { onclick: () => guarded(async () => {
        await api(`/admin/questions/${q._id}/translations/hi`, { method: 'PATCH', body: { stem: stem.value, options: opts.map((x) => x.value), explanation: expl.value } });
        toast('Hindi question saved');
      }) }, 'Save question'));
  });

  return h('div', { class: 'panel' },
    h('div', { class: 'row' }, h('h1', { style: 'margin:0' }, 'Hindi'), badge(hindi.article.replace(' ', '_')), h('span', { class: 'muted' }, `Article: ${HINDI_STATE[hindi.article]}`)),
    h('p', { class: 'muted' }, 'The Hindi is translated from the approved English. Check it side by side: names, numbers, legal terms and that each option means the same as in English. Readers see Hindi only after you publish it.'),
    hindi.error ? h('p', { class: 'error-text' }, `Last translation failed (${hindi.error.attempts}×): ${hindi.error.message}`) : null,
    hindi.warnings.length ? h('div', { class: 'panel notice' }, h('strong', {}, 'Automatic checks: '), h('ul', {}, hindi.warnings.map((w) => h('li', {}, w)))) : null,
    current ? [
      field('Title', a.title, f.title),
      field('Summary', a.summary, f.summary),
      field('Explainer', a.body, f.body),
      field('Key points (one per line)', (a.keyPoints || []).join('\n'), f.keyPoints),
      field('Why it matters for exams', a.upscRelevance, f.upscRelevance),
      h('button', { onclick: () => guarded(async () => {
        await api(`/admin/articles/${a._id}/translations/hi`, { method: 'PATCH', body: {
          title: f.title.value, summary: f.summary.value, body: f.body.value, upscRelevance: f.upscRelevance.value,
          keyPoints: f.keyPoints.value.split('\n').map((x) => x.trim()).filter(Boolean),
        } });
        toast('Hindi article saved');
      }) }, 'Save article text'),
      h('h2', {}, 'Questions'),
      qBlocks,
    ] : h('p', {}, hindi.article === 'outdated' ? 'The English was corrected, so the old Hindi is hidden from readers. A new translation is made on the next translate-content run.' : 'Not translated yet. It is translated on the next translate-content run.'),
    h('div', { class: 'row', style: 'margin-top:12px' },
      waiting ? h('button', { class: 'primary', onclick: () => guarded(async () => {
        const r = await api(`/admin/articles/${a._id}/translations/hi/publish`, { method: 'POST' });
        toast(`Hindi published (${r.published} ${r.published === 1 ? 'part' : 'parts'})${r.pendingQuestions ? `; ${r.pendingQuestions} question(s) still need translating` : ''}`);
        reload();
      }) }, 'Publish Hindi') : null,
      hindi.article !== 'published' || waiting ? h('button', { onclick: () => guarded(async () => {
        if (waiting && !confirm('Discard the Hindi waiting for review (including your edits) and translate again?')) return;
        toast('Translating…');
        const r = await api(`/admin/articles/${a._id}/translations/hi/retranslate`, { method: 'POST' });
        toast(r.outcome === 'translated' ? 'New Hindi translation ready for review' : r.outcome === 'failed' ? 'Translation failed checks; see the message above' : 'Already up to date');
        reload();
      }) }, current ? 'Translate again' : 'Translate now') : null));
}

async function hindiView() {
  const status = new URLSearchParams(location.hash.split('?')[1] || '').get('s') || 'in_review';
  const { items } = await api(`/admin/translations?status=${status}`);
  const tab = (s, label) => h('a', { href: `#/hindi?s=${s}`, style: s === status ? 'font-weight:700;text-decoration:underline' : '' }, label);
  return h('div', { class: 'panel' },
    h('h1', {}, 'Hindi'),
    h('div', { class: 'row', style: 'margin-bottom:12px' }, tab('in_review', 'Waiting for review'), tab('failed', 'Translation failed'), tab('pending', 'Not yet translated')),
    items.length ? h('table', {}, h('tbody', {}, items.map((a) => h('tr', {},
      h('td', {}, h('a', { href: `#/article/${a._id}` }, a.title), a.titleHi ? h('div', { class: 'muted', lang: 'hi' }, a.titleHi) : null, a.error ? h('div', { class: 'error-text' }, a.error) : null),
      h('td', { class: 'muted' }, fmt(a.publishedAt))))))
      : h('p', { class: 'muted' }, status === 'in_review' ? 'Nothing waiting for Hindi review.' : status === 'failed' ? 'No failed translations.' : 'Every published article has a Hindi translation.'));
}

async function pipelineView() {
  const [dash, runs, failed, autoPanel] = await Promise.all([api('/admin/dashboard'), api('/admin/jobs/runs?limit=20'), api('/admin/raw-items?status=failed&limit=20'), autoPublishPanel()]);
  const isAdmin = me.role === 'admin';
  const counts = (o) => Object.entries(o).map(([k, v]) => `${k.replace('_', ' ')}: ${v}`).join(' · ') || '—';
  return h('div', {},
    autoPanel,
    h('div', { class: 'panel' },
      h('h1', {}, 'Content status'),
      h('p', {}, h('strong', {}, 'Feed items: '), counts(dash.rawItems)),
      h('p', {}, h('strong', {}, 'Articles: '), counts(dash.articles)),
      h('p', {}, h('strong', {}, 'Questions: '), counts(dash.questions)),
      h('p', {}, h('strong', {}, 'Hindi: '), `waiting for review: ${dash.hindi.inReview} · failed: ${dash.hindi.failed} · not yet translated: ${dash.hindi.pending} `, h('a', { href: '#/hindi' }, 'open'))),
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

async function usersView() {
  const search = h('input', { placeholder: 'Search by email', value: new URLSearchParams(location.hash.split('?')[1] || '').get('q') || '' });
  const q = search.value.trim();
  const { items, total } = await api(`/admin/users?limit=50${q ? `&q=${encodeURIComponent(q)}` : ''}`);
  const grant = (u, days) => guarded(async () => {
    const until = days ? new Date(Date.now() + days * 86400000).toISOString() : null;
    await api(`/admin/users/${u.id}`, { method: 'PATCH', body: { premiumUntil: until } });
    toast(days ? `Gave ${u.email} ${days} days of Premium` : `Removed complimentary Premium from ${u.email}`);
    render();
  });
  return h('div', { class: 'panel' },
    h('h1', {}, `Users (${total})`),
    h('form', { class: 'row', onsubmit: (e) => { e.preventDefault(); location.hash = `#/users?q=${encodeURIComponent(search.value.trim())}`; } }, search, h('button', { type: 'submit' }, 'Search')),
    h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'User'), h('th', {}, 'Role'), h('th', {}, 'Premium'), h('th', {}))),
      h('tbody', {}, items.map((u) => h('tr', {},
        h('td', {}, u.name, h('div', { class: 'muted' }, `${u.email}${u.emailVerified ? '' : ' · not verified'} · ${u.signInMethods.join(', ')}`)),
        h('td', {}, u.role, u.disabled ? h('span', { class: 'badge rejected', style: 'margin-left:6px' }, 'disabled') : null),
        h('td', { class: 'muted' }, u.premium?.until && new Date(u.premium.until) > new Date() ? `${u.premium.plan} · until ${fmt(u.premium.until)}${u.premium.status === 'cancelled' ? ' (cancelled)' : ''}` : '—'),
        h('td', {}, h('div', { class: 'row' },
          u.premium?.source === 'razorpay' && new Date(u.premium.until) > new Date() ? h('span', { class: 'muted' }, 'Paid subscriber') : [
            h('button', { onclick: () => grant(u, 30) }, '+30 days'),
            h('button', { onclick: () => grant(u, 365) }, '+1 year'),
            u.premium?.source === 'admin' ? h('button', { class: 'danger', onclick: () => grant(u, 0) }, 'Remove') : null,
          ])))))));
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
    else if (route && route.startsWith('hindi')) view = await hindiView();
    else if (route && route.startsWith('users')) view = await usersView();
    else view = await articleListView('in_review', 'Review queue');
    app.replaceChildren(view);
  } catch (err) {
    app.replaceChildren(h('div', { class: 'panel' }, h('p', {}, err.message)));
  }
}

window.addEventListener('hashchange', render);
render();
