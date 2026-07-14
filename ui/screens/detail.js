// Task-detail screen (full-screen editor). Pure render(container, id) — no
// store.subscribe here; the app re-renders the active screen on every store change.
import { store } from '../store.js';
import { router } from '../router.js';
import { todayISO, addDays } from '../../lib/dates.js';
import { nextOccurrence } from '../../lib/recurrence.js';
import { escapeHtml, fieldChips } from '../components.js';

function resolveDueKey(dueKey) {
  if (dueKey === 'today') return todayISO();
  if (dueKey === 'tomorrow') return addDays(todayISO(), 1);
  if (dueKey === 'week') return addDays(todayISO(), 7);
  return null; // 'custom' or unset: caller already has the real date in state.due
}

const FOCUS_SELECTOR = '.title-input, .notes-input, .subtask-input';

export function render(container, id) {
  const t = store.getTask(id);
  if (!t) {
    router.navigate('#/today', { replace: true });
    return;
  }

  // Preserve focus + caret across re-renders (the app re-renders the active
  // screen on every store change, incl. background sync) — mirrors today.js.
  const active = document.activeElement;
  const wasFocused = active && container.contains(active) && active.matches(FOCUS_SELECTOR);
  const focusedClass = wasFocused ? [...active.classList].find((c) => ['title-input', 'notes-input', 'subtask-input'].includes(c)) : null;
  const caretPos = wasFocused && typeof active.selectionStart === 'number' ? active.selectionStart : null;

  container.innerHTML = '';

  const root = document.createElement('div');
  root.className = 'screen screen-detail';

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
  const headTitle = document.createElement('h1');
  headTitle.textContent = 'Task';
  header.appendChild(headTitle);
  root.appendChild(header);

  // Editable title
  const titleWrap = document.createElement('div');
  titleWrap.className = 'field-group';
  titleWrap.innerHTML = `<input type="text" class="title-input" value="${escapeHtml(t.title || '')}" aria-label="Task title">`;
  const titleInput = titleWrap.querySelector('.title-input');
  titleInput.addEventListener('change', () => {
    store.patch(id, { title: titleInput.value });
  });
  root.appendChild(titleWrap);

  // fieldChips state mirrors the task
  const chipState = {
    project: t.project || '',
    priority: t.priority || 'none',
    due: t.due || '',
    recur: t.recur || 'none',
    pinned: !!t.pinned,
    _dueKey: undefined,
  };

  const chipsContainer = document.createElement('div');
  chipsContainer.className = 'chips-container';
  chipsContainer.appendChild(
    fieldChips(chipState, (next) => {
      let due = next.due;
      if (next._dueKey && next._dueKey !== 'custom') {
        const resolved = resolveDueKey(next._dueKey);
        if (resolved) due = resolved;
      }
      store.patch(id, {
        project: next.project,
        priority: next.priority,
        due,
        recur: next.recur,
        pinned: next.pinned,
      });
    })
  );
  root.appendChild(chipsContainer);

  // Recurrence hint
  if (t.recur && t.recur !== 'none') {
    const hint = document.createElement('div');
    hint.className = 'recur-hint';
    const next = nextOccurrence(t.due || todayISO(), t.recur, todayISO());
    hint.textContent = `Repeats ${t.recur} · next after complete: ${next}`;
    root.appendChild(hint);
  }

  // Notes
  const notesWrap = document.createElement('div');
  notesWrap.className = 'field-group';
  notesWrap.innerHTML = `<span class="field-label">Notes</span><textarea class="notes-input" rows="4">${escapeHtml(t.notes || '')}</textarea>`;
  const notesInput = notesWrap.querySelector('.notes-input');
  notesInput.addEventListener('change', () => {
    store.patch(id, { notes: notesInput.value });
  });
  root.appendChild(notesWrap);

  // Subtasks
  const subtasksWrap = document.createElement('div');
  subtasksWrap.className = 'field-group subtasks-group';
  subtasksWrap.innerHTML = `<span class="field-label">Subtasks</span><ul class="subtask-list"></ul>
    <div class="subtask-add"><input type="text" class="subtask-input" placeholder="Add a subtask…"></div>`;

  const subtaskList = subtasksWrap.querySelector('.subtask-list');
  const subtasks = Array.isArray(t.subtasks) ? t.subtasks : [];
  subtasks.forEach((st, idx) => {
    const li = document.createElement('li');
    li.className = 'subtask-row';
    li.innerHTML = `<input type="checkbox" ${st.done ? 'checked' : ''} aria-label="Toggle subtask"><span class="subtask-text${st.done ? ' done' : ''}">${escapeHtml(st.text || '')}</span>`;
    const checkbox = li.querySelector('input');
    checkbox.addEventListener('change', () => {
      const updated = subtasks.map((s, i) => (i === idx ? { ...s, done: checkbox.checked } : s));
      store.patch(id, { subtasks: updated });
    });
    subtaskList.appendChild(li);
  });

  const subtaskInput = subtasksWrap.querySelector('.subtask-input');
  subtaskInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && subtaskInput.value.trim()) {
      e.preventDefault();
      const updated = [...subtasks, { text: subtaskInput.value.trim(), done: false }];
      store.patch(id, { subtasks: updated });
      subtaskInput.value = '';
    }
  });
  root.appendChild(subtasksWrap);

  // Buttons
  const actions = document.createElement('div');
  actions.className = 'detail-actions';

  const completeBtn = document.createElement('button');
  completeBtn.type = 'button';
  completeBtn.className = 'btn btn-primary';
  completeBtn.textContent = 'Complete';
  completeBtn.addEventListener('click', () => {
    store.complete(id);
    router.navigate('#/today', { replace: true });
  });
  actions.appendChild(completeBtn);

  const snoozeTmrwBtn = document.createElement('button');
  snoozeTmrwBtn.type = 'button';
  snoozeTmrwBtn.className = 'btn btn-secondary';
  snoozeTmrwBtn.textContent = 'Snooze Tomorrow';
  snoozeTmrwBtn.addEventListener('click', () => store.snooze(id, 1));
  actions.appendChild(snoozeTmrwBtn);

  const snoozeWeekBtn = document.createElement('button');
  snoozeWeekBtn.type = 'button';
  snoozeWeekBtn.className = 'btn btn-secondary';
  snoozeWeekBtn.textContent = 'Snooze Next week';
  snoozeWeekBtn.addEventListener('click', () => store.snooze(id, 7));
  actions.appendChild(snoozeWeekBtn);

  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'btn btn-danger';
  deleteBtn.textContent = 'Delete';
  deleteBtn.addEventListener('click', () => {
    store.remove(id);
    router.navigate('#/today', { replace: true });
  });
  actions.appendChild(deleteBtn);

  root.appendChild(actions);

  container.appendChild(root);

  // Restore focus + caret to the same field, only if it was focused before
  // this render (background re-renders must not steal focus elsewhere).
  if (wasFocused && focusedClass) {
    const freshInput = container.querySelector(`.${focusedClass}`);
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
