// Shared DOM helpers. Every innerHTML sink here escapes user content.
import { todayISO } from '../lib/dates.js';
const PRIORITIES = new Set(['P1', 'P2', 'P3']);

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export function el(html) {
  const tpl = document.createElement('template');
  tpl.innerHTML = html.trim();
  return tpl.content.firstElementChild;
}

export function priorityDot(p) {
  if (!PRIORITIES.has(p)) return '';
  return `<span class="priority-dot ${p}"></span>`;
}

export function projectChip(name) {
  if (!name) return '';
  return `<span class="project-chip">#${escapeHtml(name)}</span>`;
}

export function taskRow(task, { onOpen, onComplete, onSnooze } = {}) {
  const today = todayISO();
  const overdue = task.due && task.due < today && task.status !== 'done';
  const done = task.status === 'done';

  const row = el(`
    <li class="task-row${task.pinned ? ' top3' : ''}" data-id="${escapeHtml(task.id)}" data-done="${done}">
      <input class="task-check" type="checkbox" ${done ? 'checked' : ''} aria-label="Complete task">
      <div class="task-body">
        <span class="task-title">${escapeHtml(task.title || '')}</span>
        ${projectChip(task.project)}
        ${priorityDot(task.priority)}
      </div>
      ${task.due ? `<span class="task-due${overdue ? ' overdue' : ''}">${escapeHtml(String(task.due).slice(5))}</span>` : ''}
      <button type="button" class="snooze-btn" aria-label="Snooze to tomorrow">→ Tmrw</button>
    </li>
  `);

  const check = row.querySelector('.task-check');
  check.addEventListener('click', (e) => {
    e.stopPropagation();
    if (onComplete) onComplete(task.id);
  });

  const body = row.querySelector('.task-body');
  body.addEventListener('click', () => {
    if (onOpen) onOpen(task.id);
  });

  const snooze = row.querySelector('.snooze-btn');
  snooze.addEventListener('click', (e) => {
    e.stopPropagation();
    if (onSnooze) onSnooze(task.id, 1);
  });

  return row;
}

export function screenHeader({ title, sub, right } = {}) {
  const header = el(`
    <div class="screen-header">
      <div class="titles">
        <h1>${escapeHtml(title || '')}</h1>
        ${sub ? `<span class="sub">${escapeHtml(sub)}</span>` : ''}
      </div>
      <div class="right"></div>
    </div>
  `);
  if (right) {
    const slot = header.querySelector('.right');
    if (right instanceof Node) slot.appendChild(right);
    else slot.innerHTML = right;
  }
  return header;
}

const TABS = [
  { name: 'today', label: 'Today', icon: '☀', hash: '#/today' },
  { name: 'lists', label: 'Lists', icon: '≡', hash: '#/lists' },
  { name: 'add', label: '', icon: '+', hash: '#/add', addBtn: true },
  { name: 'review', label: 'Review', icon: '✓', hash: '#/review' },
];

export function tabbar(activeName) {
  const nav = el(`<div class="tabbar-inner"></div>`);
  for (const tab of TABS) {
    const active = tab.name === activeName;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tab-item' + (tab.addBtn ? ' tab-add' : '') + (active ? ' active' : '');
    btn.setAttribute('aria-label', tab.addBtn ? 'Add task' : tab.label);
    btn.innerHTML = `<span class="tab-icon">${tab.icon}</span>${tab.label ? `<span class="tab-label">${tab.label}</span>` : ''}`;
    btn.addEventListener('click', () => {
      location.hash = tab.hash;
    });
    nav.appendChild(btn);
  }
  return nav;
}

const PROJECT_PRESETS = []; // populated by caller via state.projectOptions if desired
const PRIORITY_OPTS = ['none', 'P1', 'P2', 'P3'];
const DUE_OPTS = [
  { key: 'today', label: 'Today' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'week', label: 'This week' },
];
const RECUR_OPTS = ['none', 'daily', 'weekdays', 'weekly', 'monthly'];

export function fieldChips(state, onChange) {
  const wrap = el(`<div class="field-group"></div>`);

  // Project
  const projGroup = el(`
    <div class="field-group">
      <span class="field-label">Project</span>
      <div class="chip-row">
        <span class="chip"><input type="text" placeholder="#project" value="${escapeHtml(state.project || '')}"></span>
      </div>
    </div>
  `);
  const projInput = projGroup.querySelector('input');
  projInput.addEventListener('input', () => onChange({ ...state, project: projInput.value.trim() }));
  wrap.appendChild(projGroup);

  // Priority
  const priGroup = el(`<div class="field-group"><span class="field-label">Priority</span><div class="chip-row"></div></div>`);
  const priRow = priGroup.querySelector('.chip-row');
  for (const p of PRIORITY_OPTS) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip' + (state.priority === p ? ' selected' : '');
    chip.textContent = p === 'none' ? 'None' : p;
    chip.addEventListener('click', () => onChange({ ...state, priority: p }));
    priRow.appendChild(chip);
  }
  wrap.appendChild(priGroup);

  // Due
  const dueGroup = el(`<div class="field-group"><span class="field-label">Due</span><div class="chip-row"></div></div>`);
  const dueRow = dueGroup.querySelector('.chip-row');
  for (const opt of DUE_OPTS) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip' + (state._dueKey === opt.key ? ' selected' : '');
    chip.textContent = opt.label;
    chip.addEventListener('click', () => onChange({ ...state, _dueKey: opt.key, _dueChoose: opt.key }));
    dueRow.appendChild(chip);
  }
  const dateChip = document.createElement('span');
  dateChip.className = 'chip';
  dateChip.innerHTML = `<input type="date" value="${escapeHtml(state.due || '')}">`;
  dateChip.querySelector('input').addEventListener('change', (e) => onChange({ ...state, due: e.target.value, _dueKey: 'custom' }));
  dueRow.appendChild(dateChip);
  wrap.appendChild(dueGroup);

  // Repeat
  const recurGroup = el(`<div class="field-group"><span class="field-label">Repeat</span><div class="chip-row"></div></div>`);
  const recurRow = recurGroup.querySelector('.chip-row');
  for (const r of RECUR_OPTS) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip' + (state.recur === r ? ' selected' : '');
    chip.textContent = r === 'none' ? 'None' : r;
    chip.addEventListener('click', () => onChange({ ...state, recur: r }));
    recurRow.appendChild(chip);
  }
  wrap.appendChild(recurGroup);

  // Pin
  const pinGroup = el(`<div class="field-group"><span class="field-label">Pin</span><div class="chip-row"></div></div>`);
  const pinRow = pinGroup.querySelector('.chip-row');
  const pinChip = document.createElement('button');
  pinChip.type = 'button';
  pinChip.className = 'chip' + (state.pinned ? ' selected' : '');
  pinChip.textContent = state.pinned ? '★ Pinned to Top-3' : '☆ Pin to Top-3';
  pinChip.addEventListener('click', () => onChange({ ...state, pinned: !state.pinned }));
  pinRow.appendChild(pinChip);
  wrap.appendChild(pinGroup);

  return wrap;
}

let toastTimer = null;
export function toast(msg) {
  let root = document.getElementById('toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toast-root';
    document.body.appendChild(root);
  }
  root.innerHTML = '';
  const node = el(`<div class="toast">${escapeHtml(msg)}</div>`);
  root.appendChild(node);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { root.innerHTML = ''; }, 2000);
}

export function syncBadge(state) {
  const label = state === 'synced' ? 'Synced' : state === 'pending' ? 'Syncing…' : 'Offline';
  return el(`<span class="badge ${escapeHtml(state)}">${escapeHtml(label)}</span>`);
}

export function emptyState(msg, { cta } = {}) {
  const wrap = el(`
    <div class="empty-state">
      <span class="headline">${escapeHtml(msg)}</span>
    </div>
  `);
  if (cta) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-secondary';
    btn.textContent = cta.label || 'Add';
    if (cta.onClick) btn.addEventListener('click', cta.onClick);
    wrap.appendChild(btn);
  }
  return wrap;
}
