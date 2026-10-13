// Derived data: the pure model functions applied to the current state and preferences.
import { state, pref } from './state.js';
import { DAYS } from './config.js';
import { dateList, nowPT, todayPT } from './lib/dates.js';
import { openTimes, bookLink } from './model/teetimes.js';
import { wetness, rainOn as rainOnW, rainPct as rainPctW, dryKey } from './model/ground.js';
import { inView as courseInView } from './model/courses.js';

export const dates = () => dateList(DAYS);
export const times = (cid, date) => openTimes(state.results[cid], date, pref, nowPT());
export const wet = (c, date) => wetness(state.weather[c.id], c.drainage?.score, date);
export const rainOn = (c, d) => rainOnW(state.weather[c.id], d);
export const rainPct = (c, d) => rainPctW(state.weather[c.id], d);
export const chance = (c, d) => { const p = rainPct(c, d); return p == null ? '' : ` (${p}% chance)`; };
export const bookLinkFor = (c, date) => bookLink(c, date, pref.players);
export const inView = c => courseInView(c, pref);

export function sorted(list) {
  const t = todayPT();
  const by = {
    rank: c => c.rank ?? 999,
    dry: c => dryKey(wet(c, t), c.drainage?.score),
    price: c => { let m = Infinity; dates().forEach(d => (times(c.id, d) || []).forEach(x => { if (x.p != null && x.p < m) m = x.p; })); return m; },
  };
  const f = by[pref.sort] || by.rank;
  return list.slice().sort((a, b) => f(a) - f(b) || (a.rank ?? 999) - (b.rank ?? 999));
}

// Cheapest matching time per date across the given courses: { date: { t, p, s, c } | null }.
export function cheapestByDay(courses, ds) {
  const out = {};
  ds.forEach(d => { let best = null; courses.forEach(c => { (times(c.id, d) || []).forEach(x => { if (x.p != null && (!best || x.p < best.p)) best = { ...x, c }; }); }); out[d] = best; });
  return out;
}
