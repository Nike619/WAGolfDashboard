// Tee-time data: decoding results.json days and filtering them. No DOM; tested in Node.

// "HHMM,price,spots;…" → [{ t: 'HH:MM', p: price|null, s: spots|null }]
export function parseDay(str) {
  if (!str) return [];
  return str.split(';').filter(Boolean).map(x => { const [t, p, s] = x.split(','); return { t: t.slice(0, 2) + ':' + t.slice(2), p: p === '' ? null : Number(p), s: s === '' ? null : Number(s) }; });
}

export function inWindow(t, win) {
  const h = Number(t.slice(0, 2)) + Number(t.slice(3)) / 60;
  if (win === 'am') return h < 11;
  if (win === 'mid') return h >= 11 && h < 14;
  if (win === 'pm') return h >= 14;
  return true;
}

// Times for one course and date that fit the filters. null when that date wasn't checked.
// now = { d: today, t: 'HH:MM' } in Pacific time; today's times at or before now are gone.
// dark = 'HH:MM' sunset; times starting after it are dropped (some booking sites list slots until 10 PM).
export function openTimes(result, date, { players, win, maxp }, now, dark = null) {
  if (!result || !result.days || !(date in result.days)) return null;
  const gone = date === now.d ? now.t : '';
  return parseDay(result.days[date]).filter(x => x.t > gone && (!dark || x.t <= dark) && (x.s == null || x.s >= players) && inWindow(x.t, win) && (!maxp || x.p == null || x.p <= maxp));
}

export const lowestPrice = rows => Math.min(...rows.map(x => x.p ?? Infinity));
// Earliest 'HH:MM' among rows, or null.
export const earliest = rows => rows.length ? rows.reduce((m, x) => x.t < m ? x.t : m, rows[0].t) : null;
export const dataAt = r => r ? (r.dataAt || r.checkedAt || null) : null;
export const isStale = (r, nowMs = Date.now()) => { const t = dataAt(r); return !t || nowMs - new Date(t) > 12 * 3600e3; };

export function bookLink(c, date, players) {
  const u = c.bookUrl || c.website;
  if (!u) return null;
  return u.replace('{date}', date).replace('{players}', players);
}
