// Central store: single source of truth for the task cache + sync state.
// Wraps lib/api.js (unchanged). Screens read via all()/getTask()/view()/etc.
// and mutate via create/patch/complete/snooze/remove/restore, then subscribe()
// to re-render when state changes (including render-on-sync reconcile).
import { makeApi } from '../lib/api.js';
import { todayISO, addDays } from '../lib/dates.js';
import { overlayPending } from '../lib/reconcile.js';
import { nextOccurrence } from '../lib/recurrence.js';

const uid = () => 'tmp-' + Date.now() + Math.random().toString(36).slice(2, 8);
const isTmp = (id) => String(id).startsWith('tmp-');

let api = null;
let tasks = [];
let syncState = 'synced';
const listeners = new Set();

function notify() {
  for (const fn of listeners) fn();
}

async function refresh() {
  if (!api) return;
  try {
    tasks = await api.list();
    notify();
  } catch (e) {
    // keep cache on failure
  }
}

function overlaid() {
  const pending = api ? api.pending() : [];
  return tasks.map((t) => overlayPending(t, pending));
}

function smartSort(list) {
  const PRI_RANK = { P1: 0, P2: 1, P3: 2, none: 3 };
  return [...list].sort((a, b) => {
    if (!!b.pinned - !!a.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
    const ad = a.due || '9999', bd = b.due || '9999';
    if (ad !== bd) return ad < bd ? -1 : 1;
    return (PRI_RANK[a.priority] ?? 3) - (PRI_RANK[b.priority] ?? 3);
  });
}

export const store = {
  init(cfg) {
    api = makeApi({
      url: cfg.url,
      pass: cfg.pass,
      onSync: (s) => {
        syncState = s;
        notify();
        if (s === 'synced') refresh(); // reconcile UI with server truth (temp->real id swap, recurring roll)
      },
    });
    return refresh();
  },

  refresh,

  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  syncState() {
    return syncState;
  },

  all() {
    return overlaid();
  },

  getTask(id) {
    return overlaid().find((t) => t.id === id);
  },

  projects() {
    const open = overlaid().filter((t) => t.status === 'open' && !t.deleted && t.project);
    const counts = new Map();
    for (const t of open) counts.set(t.project, (counts.get(t.project) || 0) + 1);
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  },

  search(q) {
    const needle = String(q || '').trim().toLowerCase();
    const open = overlaid().filter((t) => t.status === 'open' && !t.deleted);
    if (!needle) return [];
    return open.filter(
      (t) =>
        (t.title || '').toLowerCase().includes(needle) ||
        (t.project || '').toLowerCase().includes(needle)
    );
  },

  view(name, arg) {
    const today = todayISO();
    const all = overlaid();
    const open = all.filter((t) => t.status === 'open' && !t.deleted);

    if (name === 'today') {
      return smartSort(open.filter((t) => (t.due && t.due <= today) || t.pinned));
    }
    if (name === 'overdue') {
      return smartSort(open.filter((t) => t.due && t.due < today && !t.pinned));
    }
    if (name === 'top3') {
      return smartSort(open.filter((t) => t.pinned));
    }
    if (name === 'dueToday') {
      return smartSort(open.filter((t) => t.due === today && !t.pinned));
    }
    if (name === 'upcoming') {
      return smartSort(open.filter((t) => t.due && t.due > today));
    }
    if (name === 'all') {
      return smartSort(open);
    }
    if (name === 'doneWeek') {
      const weekAgo = addDays(today, -7);
      return all.filter(
        (t) =>
          t.status === 'done' &&
          !t.deleted &&
          (t.last_completed ? t.last_completed.slice(0, 10) >= weekAgo : true)
      );
    }
    if (name === 'trash') {
      return all.filter((t) => t.deleted);
    }
    if (name === 'project') {
      return smartSort(open.filter((t) => t.project === arg));
    }
    return smartSort(open);
  },

  create(fields) {
    const temp = {
      id: uid(),
      status: 'open',
      deleted: false,
      subtasks: [],
      notes: '',
      title: fields.title || '',
      project: fields.project || '',
      priority: fields.priority || 'none',
      due: fields.due || '',
      recur: fields.recur || 'none',
      pinned: !!fields.pinned,
    };
    tasks = [temp, ...tasks];
    notify();
    if (api) {
      api.create({
        title: temp.title,
        project: temp.project,
        priority: temp.priority,
        due: temp.due,
        recur: temp.recur,
        pinned: temp.pinned,
      });
    }
  },

  patch(id, patch) {
    if (isTmp(id)) return; // not yet synced; wait for the real id (reconciles on sync)
    tasks = tasks.map((t) => (t.id === id ? { ...t, ...patch } : t));
    notify();
    if (api) {
      const base = tasks.find((t) => t.id === id)?.updated || '';
      api.patch(id, patch, base);
    }
  },

  complete(id) {
    if (isTmp(id)) return; // not yet synced; wait for the real id
    const today = todayISO();
    tasks = tasks.map((t) => {
      if (t.id !== id) return t;
      // mirror the server: recurring rolls forward and stays open; one-off goes to done
      return t.recur && t.recur !== 'none'
        ? { ...t, due: nextOccurrence(t.due || today, t.recur, today), status: 'open' }
        : { ...t, status: 'done', last_completed: new Date().toISOString() };
    });
    notify();
    if (api) api.complete(id);
  },

  snooze(id, days) {
    store.patch(id, { due: addDays(todayISO(), days) });
  },

  remove(id) {
    store.patch(id, { deleted: true });
  },

  restore(id) {
    store.patch(id, { deleted: false, status: 'open' });
  },
};
