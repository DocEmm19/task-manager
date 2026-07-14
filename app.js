import { todayISO, addDays } from './lib/dates.js';
import { overlayPending } from './lib/reconcile.js';
import { makeApi } from './lib/api.js';
import { parseCapture } from './lib/parser.js';
import { nextOccurrence } from './lib/recurrence.js';

const CFG_KEY = 'ptm.config';
const DRAFT_KEY = 'ptm.draft';

function getConfig() {
  try { return JSON.parse(localStorage.getItem(CFG_KEY)) || null; } catch { return null; }
}
function setConfig(cfg) { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); }

function showSetup() {
  document.getElementById('setup').hidden = false;
  document.getElementById('app').hidden = true;
  document.getElementById('setup-save').onclick = () => {
    const url = document.getElementById('setup-url').value.trim();
    const pass = document.getElementById('setup-pass').value;
    if (!url || !pass) return;
    setConfig({ url, pass });
    location.reload();
  };
}
function showApp() {
  document.getElementById('setup').hidden = true;
  document.getElementById('app').hidden = false;
  window.startApp(getConfig()); // real implementation defined below, assigned to window.startApp
}

const PRI_RANK = { P1: 0, P2: 1, P3: 2, none: 3 };
let STATE = { tasks: [], view: 'today', expanded: null, api: null };

function smartSort(tasks, todayIso) {
  return [...tasks].sort((a, b) => {
    if (!!b.pinned - !!a.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
    const ad = a.due || '9999', bd = b.due || '9999';
    if (ad !== bd) return ad < bd ? -1 : 1;
    return (PRI_RANK[a.priority] ?? 3) - (PRI_RANK[b.priority] ?? 3);
  });
}

function filterView(tasks, view, todayIso) {
  const open = tasks.filter(t => t.status === 'open' && !t.deleted);
  if (view === 'today')    return open.filter(t => (t.due && t.due <= todayIso) || t.pinned);
  if (view === 'upcoming') return open.filter(t => t.due && t.due > todayIso);
  if (view === 'all')      return open;
  if (view === 'done') {
    const weekAgo = addDays(todayIso, -7);
    return tasks.filter(t => t.status === 'done' && !t.deleted &&
      (t.last_completed ? t.last_completed.slice(0,10) >= weekAgo : true));
  }
  if (view === 'trash')    return tasks.filter(t => t.deleted);
  return open;
}

function taskRow(t, todayIso) {
  const li = document.createElement('li');
  li.className = 'task' + (t.pinned ? ' top3' : ''); li.dataset.id = t.id;
  const overdue = t.due && t.due < todayIso;
  li.innerHTML = `
    <input class="check" type="checkbox" ${t.status === 'done' ? 'checked' : ''}>
    <span class="title">${escapeHtml(t.title)}
      ${t.project ? `<span class="chip">#${escapeHtml(t.project)}</span>` : ''}
      ${['P1','P2','P3'].includes(t.priority) ? `<span class="dot ${t.priority}"></span>` : ''}
    </span>
    ${t.due ? `<span class="due ${overdue ? 'overdue' : ''}">${escapeHtml(String(t.due).slice(5))}</span>` : ''}`;
  return li;
}

function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

function render() {
  const today = todayISO();
  const merged = STATE.tasks.map(t => overlayPending(t, STATE.api.pending()));
  const list = document.getElementById('list');
  list.innerHTML = '';

  // Today view: pinned Top-3 strip, collapsed overdue header, then due-today
  let rows = smartSort(filterView(merged, STATE.view, today), today);
  if (STATE.view === 'today') {
    const overdue = rows.filter(t => t.due && t.due < today && !t.pinned);
    if (overdue.length) {
      const h = document.createElement('li');
      h.className = 'overdue-header';
      h.textContent = `${overdue.length} overdue — tap to expand`;
      h.onclick = () => { STATE.showOverdue = !STATE.showOverdue; render(); };
      list.appendChild(h);
      if (!STATE.showOverdue) rows = rows.filter(t => !(t.due && t.due < today && !t.pinned));
    }
  }
  rows.forEach(t => list.appendChild(taskRow(t, today)));
  if (STATE.expanded) renderExpand(STATE.expanded); // reopen the expand panel after a rebuild (render wipes #list)
  renderViews();
}

function renderViews() {
  const nav = document.getElementById('views');
  const views = [['today','Today'],['upcoming','Upcoming'],['all','All'],['done','Done this week'],['trash','Trash']];
  nav.innerHTML = '';
  for (const [key, label] of views) {
    const b = document.createElement('button');
    b.textContent = label; if (key === STATE.view) b.className = 'active';
    b.onclick = () => { STATE.view = key; render(); };
    nav.appendChild(b);
  }
}

async function refresh() {
  try { STATE.tasks = await STATE.api.list(); render(); } catch (e) { /* keep cache */ }
}

function projectsFrom(tasks) {
  return [...new Set(tasks.filter(t => t.project && !t.deleted && t.status === 'open').map(t => t.project))];
}

function wireCapture() {
  const box = document.getElementById('capture');
  const preview = document.getElementById('preview');
  const suggest = document.getElementById('project-suggest');

  box.value = localStorage.getItem(DRAFT_KEY) || ''; // restore un-submitted text
  box.focus();

  const update = () => {
    localStorage.setItem(DRAFT_KEY, box.value);       // never lose in-progress text
    const p = parseCapture(box.value, todayISO());
    preview.textContent = box.value.trim()
      ? `${p.title || '(title)'}${p.project ? ' · #' + p.project : ''}` +
        `${p.priority !== 'none' ? ' · ' + p.priority : ''}${p.due ? ' · due ' + p.due.slice(5) : ''}` +
        `${p.recur !== 'none' ? ' · ' + p.recur : ''}${p.pinned ? ' · ★pinned' : ''}`
      : '';
    // '#' autocomplete
    const m = box.value.match(/#(\w*)$/);
    if (m) {
      const opts = projectsFrom(STATE.tasks).filter(x => x.startsWith(m[1]));
      suggest.innerHTML = ''; suggest.hidden = opts.length === 0;
      opts.forEach(o => { const li = document.createElement('li'); li.textContent = '#' + o;
        li.onclick = () => { box.value = box.value.replace(/#\w*$/, '#' + o + ' '); suggest.hidden = true; box.focus(); update(); };
        suggest.appendChild(li); });
    } else suggest.hidden = true;
  };

  box.addEventListener('input', update);
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && box.value.trim()) {
      const p = parseCapture(box.value, todayISO());
      const temp = { id: 'tmp-' + Date.now(), status: 'open', deleted: false, subtasks: [],
        title: p.title, project: p.project, priority: p.priority, due: p.due, recur: p.recur, pinned: p.pinned };
      STATE.tasks = [temp, ...STATE.tasks];           // optimistic insert
      STATE.api.create({ title: p.title, project: p.project, priority: p.priority, due: p.due, recur: p.recur, pinned: p.pinned });
      box.value = ''; localStorage.removeItem(DRAFT_KEY); update(); render();
      setTimeout(refresh, 2500);                       // reconcile temp -> real id
    }
  });
  update();
}

function optimisticPatch(id, patch) {
  if (String(id).startsWith('tmp-')) return; // not yet synced to the server; wait for the real id (reconciles within seconds)
  STATE.tasks = STATE.tasks.map(t => t.id === id ? { ...t, ...patch } : t);
  STATE.api.patch(id, patch, STATE.tasks.find(t => t.id === id)?.updated || '');
  render();
}

function wireList() {
  const list = document.getElementById('list');
  list.addEventListener('click', (e) => {
    const row = e.target.closest('.task'); if (!row) return;
    const id = row.dataset.id;
    if (e.target.classList.contains('check')) {          // complete (server decides done vs roll)
      if (String(id).startsWith('tmp-')) { render(); return; } // not yet synced; wait for the real id
      const today = todayISO();
      STATE.tasks = STATE.tasks.map(t => {
        if (t.id !== id) return t;
        // mirror the server: a recurring task rolls forward and stays open; a one-off goes to done
        return (t.recur && t.recur !== 'none')
          ? { ...t, due: nextOccurrence(t.due || today, t.recur, today), status: 'open' }
          : { ...t, status: 'done' };
      });
      STATE.api.complete(id); render(); return;          // render-on-sync (onSync 'synced' -> refresh) reconciles with server truth
    }
    STATE.expanded = STATE.expanded === id ? null : id;   // toggle expand
    render();                                             // render() reopens the panel for STATE.expanded
  });
}

function renderExpand(id) {
  if (STATE.expanded !== id) return;
  const row = document.querySelector(`.task[data-id="${id}"]`); if (!row) return;
  const t = STATE.tasks.find(x => x.id === id); if (!t) return;
  const panel = document.createElement('li'); panel.className = 'expand';
  panel.innerHTML = `
    <textarea placeholder="notes…">${escapeHtml(t.notes || '')}</textarea>
    <div class="subtasks"></div>
    <input class="subtask-add" placeholder="+ subtask, Enter to add">
    <div class="row-actions">
      <button data-act="snooze-tom">→ Tomorrow</button>
      <button data-act="snooze-week">→ Next week</button>
      <button data-act="pin">${t.pinned ? 'Unpin' : 'Pin to Today'}</button>
      <button data-act="del">Delete</button>
    </div>`;
  row.after(panel);

  const ta = panel.querySelector('textarea');
  ta.addEventListener('change', () => optimisticPatch(id, { notes: ta.value }));

  const subs = panel.querySelector('.subtasks');
  (t.subtasks || []).forEach((s, i) => {
    const el = document.createElement('label');
    el.innerHTML = `<input type="checkbox" ${s.done ? 'checked' : ''}> ${escapeHtml(s.text)}`;
    el.querySelector('input').onchange = (ev) => {
      const next = (t.subtasks || []).map((x, j) => j === i ? { ...x, done: ev.target.checked } : x);
      optimisticPatch(id, { subtasks: next });
    };
    subs.appendChild(el);
  });
  panel.querySelector('.subtask-add').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.value.trim()) {
      const next = [...(t.subtasks || []), { text: e.target.value.trim(), done: false }];
      e.target.value = ''; optimisticPatch(id, { subtasks: next });
    }
  });
  panel.querySelector('.row-actions').addEventListener('click', (e) => {
    const act = e.target.dataset.act; if (!act) return;
    if (act === 'snooze-tom')  optimisticPatch(id, { due: addDays(todayISO(), 1) });
    if (act === 'snooze-week') optimisticPatch(id, { due: addDays(todayISO(), 7) });
    if (act === 'pin')         optimisticPatch(id, { pinned: !t.pinned });
    if (act === 'del')         { optimisticPatch(id, { deleted: true }); STATE.expanded = null; }
  });

  if (t.recur && t.recur !== 'none') {
    const hint = document.createElement('div');
    hint.className = 'recur-hint'; hint.style.cssText = 'font-size:13px;color:var(--muted);margin-top:6px;';
    const next = nextOccurrence(t.due || todayISO(), t.recur, todayISO());
    hint.textContent = `Repeats ${t.recur} · next after complete: ${next}`;
    panel.appendChild(hint);
  }
}

window.startApp = function startApp(cfg) {
  const badge = document.getElementById('sync-badge');
  STATE.api = makeApi({ url: cfg.url, pass: cfg.pass, onSync: (s) => {
    badge.textContent = s; badge.className = 'badge ' + (s === 'synced' ? '' : s);
    if (s === 'synced') refresh(); // reconcile UI with server truth once the queue drains (fixes recurring-complete state + temp->real id swap)
  } });
  wireCapture();
  wireList();
  render();
  refresh();
  let last = 0;
  window.addEventListener('focus', () => { const now = Date.now(); if (now - last > 45000) { last = now; refresh(); } }); // debounced
  document.addEventListener('keydown', (e) => { if (e.key === 'n' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') { e.preventDefault(); document.getElementById('capture').focus(); } });
};

const cfg = getConfig();
if (!cfg) showSetup(); else showApp();
