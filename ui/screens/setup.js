// Setup screen (first-run, restyled). Pure render(container) — no
// store.subscribe here; the app re-renders the active screen on every store change.
// Ports the old app.js getConfig/setConfig first-run flow into the new UI.
import { store } from '../store.js';
import { router } from '../router.js';

const CFG_KEY = 'ptm.config';

export function render(container) {
  container.innerHTML = '';

  const root = document.createElement('div');
  root.className = 'screen screen-setup';
  root.style.justifyContent = 'center';
  root.style.minHeight = '80vh';

  const card = document.createElement('div');
  card.className = 'card setup-form';
  card.style.maxWidth = '420px';
  card.style.margin = '0 auto';
  card.innerHTML = `
    <h1>Set up</h1>
    <span class="setup-hint">Stored only on this device — never uploaded to the code.</span>
    <label>Web App URL
      <input type="text" class="setup-url-input" placeholder="https://script.google.com/…">
    </label>
    <label>Passcode
      <input type="password" class="setup-pass-input" placeholder="Passcode">
    </label>
  `;

  const saveBtn = document.createElement('button');
  saveBtn.type = 'button';
  saveBtn.className = 'btn btn-primary btn-block';
  saveBtn.textContent = 'Save';
  card.appendChild(saveBtn);

  root.appendChild(card);
  container.appendChild(root);

  const urlInput = card.querySelector('.setup-url-input');
  const passInput = card.querySelector('.setup-pass-input');

  function doSave() {
    const url = urlInput.value.trim();
    const pass = passInput.value.trim();
    if (!url || !pass) return;
    try {
      localStorage.setItem(CFG_KEY, JSON.stringify({ url, pass }));
    } catch {
      // ignore storage failures
    }
    store.init({ url, pass });
    router.navigate('#/today', { replace: true });
  }

  saveBtn.addEventListener('click', doSave);
  passInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      doSave();
    }
  });

  urlInput.focus();
}
