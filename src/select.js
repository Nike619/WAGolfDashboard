// Derived data: the pure model functions applied to the current state and preferences.
import { state, pref } from './state.js';
import { DAYS } from './config.js';
import { dateList, nowPT, todayPT } from './lib/dates.js';
import { openTimes, bookLink, lowestPrice, earliest } from './model/teetimes.js';
import { wetness, rainOn as rainOnW, rainPct as rainPctW, frostOn, lowOn, highOn, codeOn, dryKey } from './model/ground.js';
import { inView as courseInView } from './model/courses.js';
import { sunsetPT } from './model/sun.js';

export const dates = () => dateList(DAYS);
// Sunset per course and date, cached (it doesn't change, and times() runs hundreds of times per render).
const dusk = new Map();
export function sunset(c, date) {
  if (typeof c?.lat !== 'number' || typeof c?.lon !== 'number') return null;
  const k = c.id + date;
  if (!dusk.has(k)) dusk.set(k, sunsetPT(c.lat, c.lon, date));
  return dusk.get(k);
}
// id → course, rebuilt whenever a new course list is loaded.
let index = { list: null, map: null };
export const courseById = cid => { if (index.list !== state.courses) index = { list: state.courses, map: new Map(state.courses.map(c => [c.id, c])) }; return index.map.get(cid); };
export const times = (cid, date) => openTimes(state.results[cid], date, pref, nowPT(), sunset(courseById(cid), date));
export const wet = (c, date) => wetness(state.weather[c.id], c.drainage?.score, date);
export const rainOn = (c, d) => rainOnW(state.weather[c.id], d);
export const rainPct = (c, d) => rainPctW(state.weather[c.id], d);
export const frost = (c, d) => frostOn(state.weather[c.id], d);
export const low = (c, d) => lowOn(state.weather[c.id], d);
export const high = (c, d) => highOn(state.weather[c.id], d);
export const code = (c, d) => codeOn(state.weather[c.id], d);
export const chance = (c, d) => { const p = rainPct(c, d); return p == null ? '' : ` (${p}% chance)`; };
export const bookLinkFor = (c, date) => bookLink(c, date, pref.players);
export const inView = c => courseInView(c, pref);

// Sort courses by pref.sort. With a day, Driest / Cheapest / Earliest use that day; without one, Driest uses
// today and Cheapest the whole week (the week grid). Ties fall back to ranking.
export function sorted(list, day = null) {
  const t = day || todayPT(), none = Infinity;
  const pick = (c, ds) => ds.flatMap(d => times(c.id, d) || []);
  const by = {
    rank: c => c.rank ?? 999,
    dry: c => dryKey(wet(c, t), c.drainage?.score),
    price: c => { const p = lowestPrice(pick(c, day ? [day] : dates())); return isFinite(p) ? p : none; },
    early: c => { const e = earliest(pick(c, [t])); return e ? Number(e.replace(':', '')) : none; },
  };
  const f = by[pref.sort] || by.rank;
  return list.slice().sort((a, b) => (f(a) - f(b)) || (a.rank ?? 999) - (b.rank ?? 999));
}

// Cheapest matching time per date across the given courses: { date: { t, p, s, c } | null }.
export function cheapestByDay(courses, ds) {
  const out = {};
  ds.forEach(d => { let best = null; courses.forEach(c => { (times(c.id, d) || []).forEach(x => { if (x.p != null && (!best || x.p < best.p)) best = { ...x, c }; }); }); out[d] = best; });
  return out;
}
