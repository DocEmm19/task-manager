import { dropAcked } from './reconcile.js';

const Q_KEY = 'ptm.queue';
const loadQ = () => { try { return JSON.parse(localStorage.getItem(Q_KEY)) || []; } catch { return []; } };
const saveQ = (q) => localStorage.setItem(Q_KEY, JSON.stringify(q));
const uid = () => 'p' + Date.now() + Math.random().toString(36).slice(2, 8);

export function makeApi({ url, pass, onSync }) {
  async function post(payload) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...payload, passcode: pass }),
      redirect: 'follow',
    });
    const data = await res.json();
    if (!data.ok) { const err = new Error(data.error || 'request_failed'); err.rejected = true; throw err; }
    return data;
  }

  function enqueue(item) {
    const q = loadQ(); item.patchId = uid(); q.push(item); saveQ(q);
    onSync && onSync('pending');
    flush();
    return item.patchId;
  }

  async function flush() {
    let q = loadQ();
    if (q.length === 0) { onSync && onSync('synced'); return; }
    try {
      for (const item of [...q]) {
        try {
          const data = await post(item);            // send in order
          q = dropAcked(loadQ(), [data.ackId || item.patchId]);
          saveQ(q);                                  // clear only after ack
        } catch (e) {
          if (e.rejected) {                          // server refused (e.g. not_found): drop so it can't block the queue forever
            q = dropAcked(loadQ(), [item.patchId]); saveQ(q);
            continue;
          }
          throw e;                                   // network/transport error: stop, keep queue for retry
        }
      }
      onSync && onSync(loadQ().length ? 'pending' : 'synced');
    } catch (e) {
      onSync && onSync('error');                     // keep queue; retry later
    }
  }

  return {
    async list() { return (await post({ action: 'list' })).tasks; },
    create(task) { const tempId = uid(); return enqueue({ action: 'create', task, tempId }); },
    patch(id, patch, baseUpdated) { return enqueue({ action: 'patch', id, patch, baseUpdated }); },
    complete(id) { return enqueue({ action: 'complete', id }); },
    flush,
    pending: () => loadQ(),
  };
}
