import { addDays, weekday } from './dates.js';

function parts(iso) { const [y, m, d] = iso.split('-').map(Number); return { y, m, d }; }
function pad(n) { return String(n).padStart(2, '0'); }
function lastDayOfMonth(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); } // m is 1-based

export function nextOccurrence(currentDue, recur, todayIso) {
  if (recur === 'none') return currentDue;

  if (recur === 'daily') return addDays(todayIso, 1);

  if (recur === 'weekdays') {
    let iso = addDays(todayIso, 1);
    while (weekday(iso) === 0 || weekday(iso) === 6) iso = addDays(iso, 1);
    return iso;
  }

  if (recur === 'weekly') {
    const targetDow = weekday(currentDue);
    let iso = addDays(todayIso, 1);
    while (weekday(iso) !== targetDow) iso = addDays(iso, 1);
    return iso;
  }

  if (recur === 'monthly') {
    const { d: targetDay } = parts(currentDue);
    let { y, m } = parts(todayIso);          // step months forward until strictly after today
    const today = parts(todayIso);
    do {
      m += 1; if (m > 12) { m = 1; y += 1; }
    } while (y === today.y && m === today.m); // guarantee a future month
    const day = Math.min(targetDay, lastDayOfMonth(y, m));
    // ensure strictly after today even if same month clamp lands earlier (defensive)
    return `${y}-${pad(m)}-${pad(day)}`;
  }

  return currentDue;
}
