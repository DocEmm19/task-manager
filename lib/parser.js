import { resolveDateWord } from './dates.js';

const PRIORITY = { '!p1': 'P1', '!p2': 'P2', '!p3': 'P3' };
const RECUR_WORD = { day: 'daily', daily: 'daily', weekday: 'weekdays', weekdays: 'weekdays',
                     week: 'weekly', weekly: 'weekly', month: 'monthly', monthly: 'monthly' };

export function parseCapture(raw, todayIso) {
  const result = { title: '', project: '', priority: 'none', due: '', recur: 'none', pinned: false };
  const tokens = String(raw).trim().split(/\s+/).filter(Boolean);
  const titleParts = [];

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const low = t.toLowerCase();

    if (t === '*') { result.pinned = true; continue; }
    if (t.startsWith('#') && t.length > 1) { result.project = t.slice(1); continue; }
    if (low in PRIORITY) { result.priority = PRIORITY[low]; continue; }
    if (low === 'every' && i + 1 < tokens.length) {
      const next = tokens[i + 1].toLowerCase();
      if (next in RECUR_WORD) { result.recur = RECUR_WORD[next]; i++; continue; }
    }
    // date words: try single word, plus the special two-word "next week"
    if (low === 'next' && (tokens[i + 1] || '').toLowerCase() === 'week') {
      const d = resolveDateWord('next week', todayIso);
      if (d) { result.due = d; i++; continue; }
    }
    const d = resolveDateWord(low, todayIso);
    if (d && !result.due) { result.due = d; continue; }

    titleParts.push(t); // unrecognized -> keep as title text (never lose it)
  }

  result.title = titleParts.join(' ').trim() || String(raw).trim();
  return result;
}
