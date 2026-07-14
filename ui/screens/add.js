// Add screen (full-screen "with chips" editor). Pure render(container) — no
// store.subscribe here; the app re-renders the active screen on every store change.
import { store } from '../store.js';
import { router } from '../router.js';
import { todayISO, addDays } from '../../lib/dates.js';
import { parseCapture } from '../../lib/parser.js';
import { escapeHtml, fieldChips, toast } from '../components.js';

const DRAFT_KEY = 'ptm.draft.add';
const TITLE_INPUT_ID = 'add-title-input';

function defaultState() {
  return { title: '', project: '', priority: 'none', due: '', recur: 'none', pinned: false, _dueKey: '' };
}

// Module-level state (must survive re-renders triggered by store changes).
let state = defaultState();
let touched = new Set();

function readDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeDraft() {
  try {
    if (state.title || state.project || state.priority !== 'none' || state.due || state.recur !== 'none' || state.pinned) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ state, touched: [...touched] }));
    } else {
      localStorage.removeItem(DRAFT_KEY);
    }
  } catch {
    // ignore storage failures
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

function resolveDueKey(dueKey) {
  if (dueKey === 'today') return todayISO();
  if (dueKey === 'tomorrow') return addDays(todayISO(), 1);
  if (dueKey === 'week') return addDays(todayISO(), 7);
  return null; // 'custom' or unset: caller already has the real date in state.due
}

function previewText() {
  const bits = [];
  bits.push(state.title ? `"${state.title}"` : '(no title)');
  if (state.project) bits.push(`#${state.project}`);
  if (state.priority && state.priority !== 'none') bits.push(state.priority);
  if (state.due) bits.push(`due ${state.due}`);
  if (state.recur && state.recur !== 'none') bits.push(`repeats ${state.recur}`);
  if (state.pinned) bits.push('pinned');
  return bits.join(' · ');
}

function applyParse(title) {
  const p = parseCapture(title, todayISO());
  // Shorthand only writes into fields the user hasn't manually touched via chips.
  if (!touched.has('project')) state.project = p.project;
  if (!touched.has('priority')) state.priority = p.priority;
  if (!touched.has('due')) {
    state.due = p.due;
    state._dueKey = '';
  }
  if (!touched.has('recur')) state.recur = p.recur;
  if (!touched.has('pinned')) state.pinned = p.pinned;
  state.title = p.title;
}

function doSave(container, { again }) {
  if (!state.title.trim()) return;
  store.create({
    title: state.title,
    project: state.project,
    priority: state.priority,
    due: state.due,
    recur: state.recur,
    pinned: state.pinned,
  });
  toast('Added');
  clearDraft();
  state = defaultState();
  touched = new Set();
  if (again) {
    render(container);
  } else {
    router.navigate('#/today', { replace: true });
  }
}

export function render(container) {
  const wasFocused = document.activeElement && document.activeElement.id === TITLE_INPUT_ID;
  const caretPos = wasFocused ? document.activeElement.selectionStart : null;

  // On first render (fresh module load into this screen), restore any persisted draft.
  if (!wasFocused) {
    const draft = readDraft();
    if (draft && draft.state) {
      state = { ...defaultState(), ...draft.state };
      touched = new Set(draft.touched || []);
    }
  }

  container.innerHTML = '';

  const root = document.createElement('div');
  root.className = 'screen screen-add';

  // Header: back + title
  const header = document.createElement('div');
  header.className = 'screen-header';
  const backBtn = document.createElement('button');
  backBtn.type = 'button';
  backBtn.className = 'icon-btn back-btn';
  backBtn.setAttribute('aria-label', 'Back');
  backBtn.textContent = '←';
  backBtn.addEventListener('click', () => router.back());
  header.appendChild(backBtn);
  const h1 = document.createElement('h1');
  h1.textContent = 'Add task';
  header.appendChild(h1);
  root.appendChild(header);

  // Title input
  const titleWrap = document.createElement('div');
  titleWrap.className = 'field-group';
  titleWrap.innerHTML = `<input id="${TITLE_INPUT_ID}" type="text" class="title-input" placeholder="What needs doing?" value="${escapeHtml(state.title)}" aria-label="Task title">`;
  root.appendChild(titleWrap);

  const titleInput = titleWrap.querySelector('.title-input');
  titleInput.addEventListener('input', () => {
    applyParse(titleInput.value);
    writeDraft();
    preview.textContent = previewText();
  });
  titleInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && state.title.trim()) {
      e.preventDefault();
      doSave(container, { again: false });
    }
  });

  // Preview line (resolved state, not raw parse)
  const preview = document.createElement('div');
  preview.className = 'capture-hint';
  preview.textContent = state.title ? previewText() : 'Type to add · tap chips below to set fields';
  root.appendChild(preview);

  // Chips
  const chipsContainer = document.createElement('div');
  chipsContainer.className = 'chips-container';
  chipsContainer.appendChild(
    fieldChips(state, (next) => {
      // Mark any field the user changed via chips as touched (chips win over shorthand).
      if (next.project !== state.project) touched.add('project');
      if (next.priority !== state.priority) touched.add('priority');
      if (next.recur !== state.recur) touched.add('recur');
      if (next.pinned !== state.pinned) touched.add('pinned');
      if (next._dueKey !== state._dueKey || next.due !== state.due) touched.add('due');

      let due = next.due;
      if (next._dueKey && next._dueKey !== 'custom') {
        const resolved = resolveDueKey(next._dueKey);
        if (resolved) due = resolved;
      }
      state = { ...next, due };
      writeDraft();
      render(container);
    })
  );
  root.appendChild(chipsContainer);

  // Actions
  const actions = document.createElement('div');
  actions.className = 'detail-actions';

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'btn btn-primary';
  saveBtn.textContent = 'Save';
  saveBtn.addEventListener('click', () => doSave(container, { again: false }));
  actions.appendChild(saveBtn);

  const saveAgainBtn = document.createElement('button');
  saveAgainBtn.type = 'button';
  saveAgainBtn.className = 'btn btn-secondary';
  saveAgainBtn.textContent = 'Save & add another';
  saveAgainBtn.addEventListener('click', () => doSave(container, { again: true }));
  actions.appendChild(saveAgainBtn);

  root.appendChild(actions);

  container.appendChild(root);

  // Restore focus + caret on the title input across re-renders, but only if it
  // was the focused element before this render (otherwise re-renders triggered
  // by typing in other fields, e.g. the #project chip input, would steal focus
  // back to the title after every keystroke).
  if (wasFocused) {
    const freshInput = document.getElementById(TITLE_INPUT_ID);
    if (freshInput) {
      freshInput.focus();
      const pos = caretPos == null ? freshInput.value.length : caretPos;
      try {
        freshInput.setSelectionRange(pos, pos);
      } catch {
        // ignore (some input types don't support selection ranges)
      }
    }
  }
}
