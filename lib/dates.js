// All date math uses UTC-anchored plain dates (no DST anywhere), except
// "what is today", which resolves against the IST calendar via Intl.
const DOW = { sun:0, mon:1, tue:2, wed:3, thu:4, fri:5, sat:6,
              sunday:0, monday:1, tuesday:2, wednesday:3, thursday:4, friday:5, saturday:6 };

export function todayISO(now = new Date()) {
  // en-CA formats as YYYY-MM-DD; timeZone pins the calendar day to IST.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(now);
}

function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function toISO(dt) {
  return dt.toISOString().slice(0, 10);
}

export function addDays(iso, n) {
  const dt = parseISO(iso);
  dt.setUTCDate(dt.getUTCDate() + n);
  return toISO(dt);
}

export function weekday(iso) {
  return parseISO(iso).getUTCDay();
}

export function resolveDateWord(word, todayIso) {
  const w = String(word).trim().toLowerCase();
  if (w === 'today') return todayIso;
  if (w === 'tomorrow' || w === 'tmrw') return addDays(todayIso, 1);
  if (w === 'next week') return addDays(todayIso, 7);
  if (w in DOW) {
    const target = DOW[w];
    const diff = (target - weekday(todayIso) + 7) % 7; // 0 => today
    return addDays(todayIso, diff);
  }
  return null;
}
