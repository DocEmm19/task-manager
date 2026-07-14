// Hash router: '#/name' or '#/name/param' -> routes[name].render(container, param).
// Guards to '#/setup' when no config exists. Preserves scrollY per route name.
const CFG_KEY = 'ptm.config';

function hasConfig() {
  try {
    return !!JSON.parse(localStorage.getItem(CFG_KEY));
  } catch {
    return false;
  }
}

let routes = {};
let current = { name: '', param: undefined };
const scrollPositions = new Map();

function parseHash() {
  const raw = (location.hash || '').replace(/^#\/?/, '');
  const [name, ...rest] = raw.split('/');
  const param = rest.length ? decodeURIComponent(rest.join('/')) : undefined;
  return { name: name || '', param };
}

function saveScroll(name) {
  if (name) scrollPositions.set(name, window.scrollY);
}

function restoreScroll(name) {
  const y = scrollPositions.get(name);
  window.scrollTo(0, y || 0);
}

function dispatch() {
  const { name, param } = parseHash();

  if (!hasConfig() && name !== 'setup') {
    router.navigate('#/setup', { replace: true });
    return;
  }

  const resolvedName = routes[name] ? name : (hasConfig() ? 'today' : 'setup');
  if (!routes[resolvedName]) return; // no routes registered yet

  saveScroll(current.name);
  current = { name: resolvedName, param };

  const container = document.getElementById('screen');
  if (!container) return;
  routes[resolvedName].render(container, param);
  restoreScroll(resolvedName);
}

export const router = {
  init(routeTable) {
    routes = routeTable || {};
    window.addEventListener('hashchange', dispatch);
    dispatch();
  },

  navigate(hash, opts = {}) {
    const { replace = false } = opts;
    if (replace) {
      const url = new URL(location.href);
      url.hash = hash;
      history.replaceState(null, '', url);
      dispatch();
    } else {
      location.hash = hash;
    }
  },

  back() {
    history.back();
  },

  currentName() {
    return current.name;
  },

  // Re-render the current screen in place (used by the global store subscription
  // so screens stay pure render() functions and don't each manage subscriptions).
  rerender() {
    if (!current.name || !routes[current.name]) return;
    const container = document.getElementById('screen');
    if (container) routes[current.name].render(container, current.param);
  },
};
