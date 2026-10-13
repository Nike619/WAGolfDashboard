// Dates are YYYY-MM-DD strings in Pacific time; tee times are HH:MM strings.
export const TZ = 'America/Los_Angeles';

export function todayPT() { return new Date().toLocaleDateString('en-CA', { timeZone: TZ }); }

// Pacific date and HH:MM, recomputed at most once a minute (tee-time filtering runs hundreds of times per render).
let clk = {};
export function nowPT() {
  const m = Math.floor(Date.now() / 60000);
  if (clk.m !== m) clk = { m, d: todayPT(), t: new Date().toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }) };
  return clk;
}

export function shift(iso, n) { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
export function dateList(n) { const t = todayPT(); return [...Array(n)].map((_, i) => shift(t, i)); }

export function dLabel(iso, short) { const d = new Date(iso + 'T12:00:00Z'); return d.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', ...(short ? {} : { month: 'short', day: 'numeric' }) }); }
// "Today", "Tomorrow", else "Wed, Oct 14".
export function dayName(iso) { const t = todayPT(); return iso === t ? 'Today' : iso === shift(t, 1) ? 'Tomorrow' : dLabel(iso); }
export function dNum(iso) { const d = new Date(iso + 'T12:00:00Z'); return (d.getUTCMonth() + 1) + '/' + d.getUTCDate(); }
export function fmtT(hm) { let [h, m] = hm.split(':').map(Number); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return h + ':' + String(m).padStart(2, '0') + ' ' + ap; }
export function ago(iso) {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso)) / 1000;
  if (s < 90) return 'just now';
  if (s < 3600) return Math.round(s / 60) + ' min ago';
  if (s < 86400) return Math.round(s / 3600) + ' hr ago';
  return Math.round(s / 86400) + ' days ago';
}
