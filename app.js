// Entry point: read config -> init store -> init router -> render tab bar.
import { store } from './ui/store.js';
import { router } from './ui/router.js';
import { tabbar } from './ui/components.js';

import * as today from './ui/screens/today.js';
import * as lists from './ui/screens/lists.js';
import * as add from './ui/screens/add.js';
import * as review from './ui/screens/review.js';
import * as detail from './ui/screens/detail.js';
import * as settings from './ui/screens/settings.js';
import * as setup from './ui/screens/setup.js';

const CFG_KEY = 'ptm.config';

function getConfig() {
  try { return JSON.parse(localStorage.getItem(CFG_KEY)) || null; } catch { return null; }
}

function renderTabbar() {
  const nav = document.getElementById('tabbar');
  if (!nav) return;
  nav.innerHTML = '';
  nav.appendChild(tabbar(router.currentName()));
}

const routes = { today, lists, add, review, detail, task: detail, settings, setup };

function boot() {
  router.init(routes);
  renderTabbar();
  window.addEventListener('hashchange', renderTabbar);
  // Global re-render: any store change re-renders the active screen + tab bar.
  store.subscribe(() => { router.rerender(); renderTabbar(); });
}

const cfg = getConfig();
if (cfg) {
  store.init(cfg).then(boot).catch(boot);
} else {
  boot();
}
