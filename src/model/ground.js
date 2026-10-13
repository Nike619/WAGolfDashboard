// Ground-condition model: drainage score + recent rain → Dry / Damp / Soft / Soggy. No DOM; tested in Node.
// w is one course's entry in weather.json: { days: { 'YYYY-MM-DD': [rain in, chance %, evaporation in, low °F, frost until, snow in] } }.
import { shift } from '../lib/dates.js';

export const RETENTION = { 5: .15, 4: .35, 3: .6, 2: .85, 1: 1 };
export const LEVELS = [['dry', 'Dry', .08], ['damp', 'Damp', .25], ['soft', 'Soft', .5], ['soggy', 'Soggy', Infinity]];
const WEIGHTS = [1, 1, .6, .35]; // that day, 1, 2 and 3 days before
const TURF = 0.8;                // turf uses about 80% of reference evaporation (ET0)
const SNOW_IN = 1;               // an inch or more on the ground: "Snow", whatever the rain

// Per-day fields in weather.json: [rain in, chance %, evaporation in, low °F, frost until, snow depth in, high °F, weather code].
const day = (w, d) => w?.days?.[d];
const num = (v, i) => v && v[i] != null && v[i] !== '' ? Number(v[i]) : null;
export function rainOn(w, d) { return num(day(w, d), 0) || 0; }
export function rainPct(w, d) { return num(day(w, d), 1); }
export function evapOn(w, d) { return num(day(w, d), 2) || 0; }
export function lowOn(w, d) { return num(day(w, d), 3); }
export function frostOn(w, d) { return day(w, d)?.[4] || null; }
export function snowOn(w, d) { return num(day(w, d), 5) || 0; }
export function highOn(w, d) { return num(day(w, d), 6); }
export function codeOn(w, d) { return num(day(w, d), 7); }

// Wetness index: each of the last four days' rain, minus what evaporation has dried since it fell, weighted
// (that day 1, 1 day before 1, 2 days before 0.6, 3 days before 0.35) and multiplied by the course's retention.
// Drying runs oldest day to newest; each day's drying (0.8 × reference evaporation) takes the newest rain
// first, since that's what sits at the surface, and can't touch rain that hasn't fallen yet.
// With no evaporation data this is the original rain-only index.
export function wetness(w, score, date) {
  if (!w || !w.days || !score) return null;
  const at = n => shift(date, -n);
  const left = [];                                   // rain still in the ground, oldest first: [daysAgo, inches]
  let dried = 0;
  for (let n = 3; n >= 0; n--) {
    left.push([n, rainOn(w, at(n))]);
    let e = TURF * evapOn(w, at(n));
    for (let i = left.length - 1; i >= 0 && e > 0; i--) { const take = Math.min(left[i][1], e); left[i][1] -= take; e -= take; dried += take; }
  }
  const prior = rainOn(w, at(1)) + rainOn(w, at(2)) + rainOn(w, at(3));
  const base = { prior, day: rainOn(w, date), dried, snow: snowOn(w, date) };
  if (base.snow >= SNOW_IN) return { ...base, idx: 99, key: 'snow', label: 'Snow' };
  const idx = left.reduce((a, [n, r]) => a + WEIGHTS[n] * r, 0) * (RETENTION[score] ?? .6);
  const lv = LEVELS.find(l => idx < l[2]);
  return { ...base, idx, key: lv[0], label: lv[1] };
}

// Sort key for "driest": the wetness index, or a drainage-only guess when there's no rain data.
export const dryKey = (wet, score) => wet ? wet.idx : (6 - (score || 3)) / 10;
