// Today (home/focus) screen. Pure render(container) — no store.subscribe here;
// the app re-renders the active screen on every store change (see app.js).
import { store } from '../store.js';
import { router } from '../router.js';
import { todayISO } from '../../lib/dates.js';
import { parseCapture } from '../../lib/parser.js';
import {
  screenHeader,
  syncBadge,
  taskRow,
  emptyState,
  escapeHtml,
} from '../components.js';

const DRAFT_KEY = 'ptm.draft';
const CAPTURE_INPUT_ID = 'today-capture-input';

// Module-level UI state that must survive re-renders triggered by store changes.
let showOverdue = false;

function greeting() {
  const hour = new Date().toLocaleString('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  });
  const h = Number(hour);
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function dateSub() {
  const d = new Date();
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  });
}

function readDraft() {
  try {
    return localStorage.getItem(DRAFT_KEY) || '';
  } catch {
    return '';
  }
}

function writeDraft(v) {
  try {
    if (v) localStorage.setItem(DRAFT_KEY, v);
    else localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore storage failures
  }
}

function parsePreviewText(value) {
  if (!value.trim()) return '';
  const parsed = parseCapture(value, todayISO());
  const bits = [];
  bits.push(parsed.title ? `"${parsed.title}"` : '(no title)');
  if (parsed.project) bits.push(`#${parsed.project}`);
  if (parsed.priority && parsed.priority !== 'none') bits.push(parsed.priority);
  if (parsed.due) bits.push(`due ${parsed.due}`);
  if (parsed.recur && parsed.recur !== 'none') bits.push(`repeats ${parsed.recur}`);
  if (parsed.pinned) bits.push('pinned');
  return bits.join(' · ');
}

export function render(container) {
  container.innerHTML = '';

  const wasFocused = document.activeElement && document.activeElement.id === CAPTURE_INPUT_ID;
  const caretPos = wasFocused ? document.activeElement.selectionStart : null;

  const root = document.createElement('div');
  root.className = 'screen screen-today';

  // 1. Header
  const right = document.createElement('div');
  right.className = 'header-right-slot';
  const gearBtn = document.createElement('button');
  gearBtn.type = 'button';
  gearBtn.className = 'icon-btn';
  gearBtn.setAttribute('aria-label', 'Settings');
  gearBtn.textContent = '⚙';
  gearBtn.addEventListener('click', () => router.navigate('#/settings'));
  right.appendChild(gearBtn);
  right.appendChild(syncBadge(store.syncState()));

  root.appendChild(screenHeader({ title: greeting(), sub: dateSub(), right }));

  // 2. Persistent capture bar
  const draft = readDraft();
  const captureWrap = document.createElement('div');
  captureWrap.className = 'capture-bar';
  captureWrap.innerHTML = `
    <input id="${CAPTURE_INPUT_ID}" type="text" class="capture-input"
      placeholder="Add a task… e.g. Ship deck #b2b !p1 fri"
      value="${escapeHtml(draft)}">
    <span class="capture-hint">${draft ? escapeHtml(parsePreviewText(draft)) : 'Enter to save · #project !p1 fri every mon *pin'}</span>
  `;
  root.appendChild(captureWrap);

  const input = captureWrap.querySelector('.capture-input');
  const hint = captureWrap.querySelector('.capture-hint');

  input.addEventListener('input', () => {
    writeDraft(input.value);
    hint.textContent = input.value.trim()
      ? parsePreviewText(input.value)
      : 'Enter to save · #project !p1 fri every mon *pin';
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      e.preventDefault();
      const fields = parseCapture(input.value, todayISO());
      store.create(fields);
      input.value = '';
      writeDraft('');
      hint.textContent = 'Enter to save · #project !p1 fri every mon *pin';
    }
  });

  // 3. Top-3 card
  const top3 = store.view('top3');
  if (top3.length) {
    const card = document.createElement('div');
    card.className = 'top3-card';
    const label = document.createElement('div');
    label.className = 'top3-card-label';
    label.textContent = 'Focus';
    card.appendChild(label);
    const list = document.createElement('ul');
    list.className = 'task-list';
    for (const t of top3) {
      list.appendChild(
        taskRow(t, {
          onOpen: (id) => router.navigate('#/task/' + id),
          onComplete: (id) => store.complete(id),
          onSnooze: (id, d) => store.snooze(id, d),
        })
      );
    }
    card.appendChild(list);
    root.appendChild(card);
  }

  // 4. Overdue (collapsible pill)
  const overdue = store.view('overdue');
  if (overdue.length) {
    const overdueWrap = document.createElement('div');
    overdueWrap.className = 'overdue-section';
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'overdue-pill';
    pill.textContent = `${overdue.length} overdue`;
    pill.setAttribute('aria-expanded', String(showOverdue));
    pill.addEventListener('click', () => {
      showOverdue = !showOverdue;
      render(container);
    });
    overdueWrap.appendChild(pill);

    if (showOverdue) {
      const list = document.createElement('ul');
      list.className = 'task-list';
      for (const t of overdue) {
        list.appendChild(
          taskRow(t, {
            onOpen: (id) => router.navigate('#/task/' + id),
            onComplete: (id) => store.complete(id),
            onSnooze: (id, d) => store.snooze(id, d),
          })
        );
      }
      overdueWrap.appendChild(list);
    }
    root.appendChild(overdueWrap);
  }

  // 5. Due today
  const dueToday = store.view('dueToday');
  if (dueToday.length) {
    const section = document.createElement('div');
    section.className = 'due-today-section';
    const list = document.createElement('ul');
    list.className = 'task-list';
    for (const t of dueToday) {
      list.appendChild(
        taskRow(t, {
          onOpen: (id) => router.navigate('#/task/' + id),
          onComplete: (id) => store.complete(id),
          onSnooze: (id, d) => store.snooze(id, d),
        })
      );
    }
    section.appendChild(list);
    root.appendChild(section);
  }

  // 7. Empty state
  if (!top3.length && !overdue.length && !dueToday.length) {
    root.appendChild(emptyState("You're clear for today ✨"));
  }

  container.appendChild(root);

  // Restore focus + caret position on the capture input across re-renders.
  if (wasFocused) {
    const freshInput = document.getElementById(CAPTURE_INPUT_ID);
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
