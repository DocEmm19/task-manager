// Settings screen. Pure render(container) — no store.subscribe here; the app
// re-renders the active screen on every store change (see app.js).
import { store } from '../store.js';
import { router } from '../router.js';
import { escapeHtml, toast } from '../components.js';

const CFG_KEY = 'ptm.config';
const APP_VERSION = 'v2.0 (multi-screen)';

function readConfig() {
  try {
    return JSON.parse(localStorage.getItem(CFG_KEY)) || { url: '', pass: '' };
  } catch {
    return { url: '', pass: '' };
  }
}

function clearLocalState() {
  try {
    localStorage.removeItem(CFG_KEY);
    localStorage.removeItem('ptm.queue');
    // Remove any per-screen draft keys (ptm.draft, ptm.draft.add, etc).
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('ptm.draft')) localStorage.removeItem(key);
    }
  } catch {
    // ignore storage failures
  }
}

function exportTasks() {
  const data = JSON.stringify(store.all(), null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'tasks-export.json';
  link.click();
  URL.revokeObjectURL(url);
}

export function render(container) {
  container.innerHTML = '';

  const root = document.createElement('div');
  root.className = 'screen screen-settings';

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
  h1.textContent = 'Settings';
  header.appendChild(h1);
  root.appendChild(header);

  // Config form
  const cfg = readConfig();
  const formCard = document.createElement('div');
  formCard.className = 'card setup-form';
  formCard.innerHTML = `
    <label>Web App URL
      <input type="text" class="cfg-url-input" value="${escapeHtml(cfg.url || '')}" placeholder="https://script.google.com/…">
    </label>
    <label>Passcode
      <input type="password" class="cfg-pass-input" value="${escapeHtml(cfg.pass || '')}" placeholder="Passcode">
    </label>
  `;
  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'btn btn-primary btn-block';
  saveBtn.textContent = 'Save';
  formCard.appendChild(saveBtn);
  root.appendChild(formCard);

  const urlInput = formCard.querySelector('.cfg-url-input');
  const passInput = formCard.querySelector('.cfg-pass-input');
  saveBtn.addEventListener('click', () => {
    const url = urlInput.value.trim();
    const pass = passInput.value.trim();
    if (!url || !pass) return;
    try {
      localStorage.setItem(CFG_KEY, JSON.stringify({ url, pass }));
    } catch {
      // ignore storage failures
    }
    store.init({ url, pass });
    toast('Saved');
  });

  // Export tasks
  const exportBtn = document.createElement('button');
  exportBtn.type = 'button';
  exportBtn.className = 'btn btn-secondary btn-block';
  exportBtn.textContent = 'Export tasks';
  exportBtn.addEventListener('click', exportTasks);
  root.appendChild(exportBtn);

  // Sign out
  const signOutBtn = document.createElement('button');
  signOutBtn.type = 'button';
  signOutBtn.className = 'btn btn-danger btn-block';
  signOutBtn.textContent = 'Sign out';
  signOutBtn.addEventListener('click', () => {
    clearLocalState();
    router.navigate('#/setup', { replace: true });
  });
  root.appendChild(signOutBtn);

  // About
  const about = document.createElement('div');
  about.className = 'group-label';
  about.textContent = `Personal Task Manager · ${APP_VERSION}`;
  root.appendChild(about);

  container.appendChild(root);
}
