// Review screen. Pure render(container) — no store.subscribe here; the app
// re-renders the active screen on every store change (see app.js).
// Done-this-week tasks, grouped by day (Today / Yesterday / weekday name).
import { store } from '../store.js';
import { todayISO, addDays } from '../../lib/dates.js';
import { screenHeader, syncBadge, emptyState, escapeHtml, projectChip } from '../components.js';

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function dayLabel(iso, today) {
  if (iso === today) return 'Today';
  if (iso === addDays(today, -1)) return 'Yesterday';
  const [y, m, d] = iso.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return WEEKDAY_NAMES[dow];
}

function doneRow(task) {
  const row = document.createElement('li');
  row.className = 'task-row';
  row.dataset.id = task.id;

  const body = document.createElement('div');
  body.className = 'task-body';
  body.innerHTML = `
    <span class="task-title">${escapeHtml(task.title || '')}</span>
    ${projectChip(task.project)}
  `;
  row.appendChild(body);

  const restoreBtn = document.createElement('button');
  restoreBtn.type = 'button';
  restoreBtn.className = 'btn btn-secondary';
  restoreBtn.textContent = 'Restore';
  restoreBtn.setAttribute('aria-label', 'Restore task');
  restoreBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    store.restore(task.id);
  });
  row.appendChild(restoreBtn);

  return row;
}

export function render(container) {
  container.innerHTML = '';

  const root = document.createElement('div');
  root.className = 'screen screen-review';

  root.appendChild(screenHeader({ title: 'Review', right: syncBadge(store.syncState()) }));

  const doneWeek = store.view('doneWeek');

  const countHeader = document.createElement('div');
  countHeader.className = 'group-label';
  countHeader.textContent = `${doneWeek.length} done this week`;
  root.appendChild(countHeader);

  if (!doneWeek.length) {
    root.appendChild(emptyState('Nothing completed this week yet'));
    container.appendChild(root);
    return;
  }

  const today = todayISO();

  // Bucket by completion day (last_completed date, YYYY-MM-DD), most recent day first.
  const buckets = new Map();
  for (const t of doneWeek) {
    const day = t.last_completed ? t.last_completed.slice(0, 10) : today;
    if (!buckets.has(day)) buckets.set(day, []);
    buckets.get(day).push(t);
  }
  const days = [...buckets.keys()].sort((a, b) => (a < b ? 1 : -1));

  for (const day of days) {
    const group = document.createElement('div');
    group.className = 'day-group';

    const label = document.createElement('div');
    label.className = 'day-label';
    label.textContent = dayLabel(day, today);
    group.appendChild(label);

    const list = document.createElement('ul');
    list.className = 'task-list';
    for (const t of buckets.get(day)) {
      list.appendChild(doneRow(t));
    }
    group.appendChild(list);

    root.appendChild(group);
  }

  container.appendChild(root);
}
