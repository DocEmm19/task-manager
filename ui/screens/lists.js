// Lists screen. Pure render(container, param) — no store.subscribe here;
// the app re-renders the active screen on every store change (see app.js).
// Sub-routing via `param`:
//   undefined        -> index: global search + Views group + Projects group
//   'upcoming'|'all'|'done'|'trash' -> filtered view w/ back header
//   'p/<name>'        -> project view w/ back header
import { store } from '../store.js';
import { router } from '../router.js';
import { screenHeader, taskRow, emptyState, escapeHtml } from '../components.js';

// Module-level UI state that must survive re-renders triggered by store changes.
let searchValue = '';

const SEARCH_INPUT_ID = 'lists-search-input';

const VIEW_MAP = {
  upcoming: { store: 'upcoming', label: 'Upcoming' },
  all: { store: 'all', label: 'All' },
  done: { store: 'doneWeek', label: 'Done' },
  trash: { store: 'trash', label: 'Trash' },
};

function backHeader(title) {
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
  h1.textContent = title;
  header.appendChild(h1);
  return header;
}

function renderTaskList(root, tasks, { emptyMsg, isTrash } = {}) {
  if (!tasks.length) {
    root.appendChild(emptyState(emptyMsg || 'Nothing here'));
    return;
  }
  const list = document.createElement('ul');
  list.className = 'task-list';
  for (const t of tasks) {
    if (isTrash) {
      const row = taskRow(t, {
        onOpen: (id) => router.navigate('#/task/' + id),
      });
      // Replace the default checkbox/snooze affordances with a Restore action for trash rows.
      const check = row.querySelector('.task-check');
      if (check) check.remove();
      const snoozeBtn = row.querySelector('.snooze-btn');
      if (snoozeBtn) {
        snoozeBtn.textContent = 'Restore';
        snoozeBtn.setAttribute('aria-label', 'Restore task');
        const clone = snoozeBtn.cloneNode(true);
        snoozeBtn.replaceWith(clone);
        clone.addEventListener('click', (e) => {
          e.stopPropagation();
          store.restore(t.id);
        });
      }
      list.appendChild(row);
    } else {
      list.appendChild(
        taskRow(t, {
          onOpen: (id) => router.navigate('#/task/' + id),
          onComplete: (id) => store.complete(id),
          onSnooze: (id, d) => store.snooze(id, d),
        })
      );
    }
  }
  root.appendChild(list);
}

function renderIndex(container) {
  const wasFocused = document.activeElement && document.activeElement.id === SEARCH_INPUT_ID;
  const caretPos = wasFocused ? document.activeElement.selectionStart : null;

  const root = document.createElement('div');
  root.className = 'screen screen-lists';

  root.appendChild(screenHeader({ title: 'Lists' }));

  // Global search box
  const searchWrap = document.createElement('div');
  searchWrap.className = 'field-group';
  searchWrap.innerHTML = `<input id="${SEARCH_INPUT_ID}" type="text" class="search-input" placeholder="Search all tasks…" value="${escapeHtml(searchValue)}">`;
  root.appendChild(searchWrap);

  const searchInput = searchWrap.querySelector('input');
  searchInput.addEventListener('input', () => {
    searchValue = searchInput.value;
    render(container);
  });

  if (searchValue.trim()) {
    const results = store.search(searchValue);
    const resultsSection = document.createElement('div');
    resultsSection.className = 'search-results';
    renderTaskList(resultsSection, results, { emptyMsg: 'No matching tasks' });
    root.appendChild(resultsSection);
  } else {
    const anyOpen = store.view('all').length > 0;

    if (!anyOpen) {
      root.appendChild(emptyState('Nothing here yet'));
    } else {
      // Views group
      const viewsLabel = document.createElement('div');
      viewsLabel.className = 'group-label';
      viewsLabel.textContent = 'Views';
      root.appendChild(viewsLabel);

      const viewsList = document.createElement('ul');
      viewsList.className = 'link-list';
      const VIEWS = [
        { key: 'upcoming', label: 'Upcoming' },
        { key: 'all', label: 'All' },
        { key: 'done', label: 'Done' },
        { key: 'trash', label: 'Trash' },
      ];
      for (const v of VIEWS) {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'link-row';
        btn.textContent = v.label;
        btn.addEventListener('click', () => router.navigate('#/lists/' + v.key));
        li.appendChild(btn);
        viewsList.appendChild(li);
      }
      root.appendChild(viewsList);

      // Projects group
      const projects = store.projects();
      if (projects.length) {
        const projLabel = document.createElement('div');
        projLabel.className = 'group-label';
        projLabel.textContent = 'Projects';
        root.appendChild(projLabel);

        const projList = document.createElement('ul');
        projList.className = 'link-list';
        for (const p of projects) {
          const li = document.createElement('li');
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'link-row';
          btn.innerHTML = `<span>#${escapeHtml(p.name)}</span><span class="count">${p.count}</span>`;
          btn.addEventListener('click', () => router.navigate('#/lists/p/' + encodeURIComponent(p.name)));
          li.appendChild(btn);
          projList.appendChild(li);
        }
        root.appendChild(projList);
      }
    }
  }

  container.innerHTML = '';
  container.appendChild(root);

  if (wasFocused) {
    const freshInput = document.getElementById(SEARCH_INPUT_ID);
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

function renderView(container, key) {
  const cfg = VIEW_MAP[key];
  const root = document.createElement('div');
  root.className = 'screen screen-lists';
  root.appendChild(backHeader(cfg.label));

  const emptyMsgs = {
    upcoming: 'Nothing upcoming',
    all: 'Nothing here yet',
    done: 'Nothing completed this week yet',
    trash: 'Trash is empty',
  };

  const tasks = store.view(cfg.store);
  renderTaskList(root, tasks, { emptyMsg: emptyMsgs[key], isTrash: key === 'trash' });

  container.innerHTML = '';
  container.appendChild(root);
}

function renderProject(container, project) {
  const root = document.createElement('div');
  root.className = 'screen screen-lists';
  root.appendChild(backHeader('#' + project));

  const tasks = store.view('project', project);
  renderTaskList(root, tasks, { emptyMsg: 'Nothing here yet' });

  container.innerHTML = '';
  container.appendChild(root);
}

export function render(container, param) {
  if (!param) {
    renderIndex(container);
    return;
  }
  if (param.startsWith('p/')) {
    renderProject(container, decodeURIComponent(param.slice(2)));
    return;
  }
  if (VIEW_MAP[param]) {
    renderView(container, param);
    return;
  }
  // Unknown sub-route: fall back to index.
  renderIndex(container);
}
