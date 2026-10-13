// Ground-condition model: drainage score + recent rain → Dry / Damp / Soft / Soggy. No DOM; tested in Node.
// w is one course's entry in weather.json: { days: { 'YYYY-MM-DD': [inches, chance%] } }.
import { shift } from '../lib/dates.js';

export const RETENTION = { 5: .15, 4: .35, 3: .6, 2: .85, 1: 1 };
export const LEVELS = [['dry', 'Dry', .08], ['damp', 'Damp', .25], ['soft', 'Soft', .5], ['soggy', 'Soggy', Infinity]];

export function rainOn(w, d) { const v = w?.days?.[d]; return v ? Number(v[0]) || 0 : 0; }
export function rainPct(w, d) { const v = w?.days?.[d]; return v && v[1] != null ? Number(v[1]) : null; }

// Wetness index = (that day + 1 day before + 0.6 × 2 days before + 0.35 × 3 days before) × retention.
export function wetness(w, score, date) {
  if (!w || !w.days || !score) return null;
  const r = n => rainOn(w, shift(date, n));
  const rain = r(0) + r(-1) + r(-2) * .6 + r(-3) * .35;
  const idx = rain * (RETENTION[score] ?? .6);
  const lv = LEVELS.find(l => idx < l[2]);
  return { idx, key: lv[0], label: lv[1], prior: r(-1) + r(-2) + r(-3), day: r(0) };
}

// Sort key for "driest": the wetness index, or a drainage-only guess when there's no rain data.
export const dryKey = (wet, score) => wet ? wet.idx : (6 - (score || 3)) / 10;
