// App state (loaded data + what's selected) and the viewer's filter preferences.
import { REGIONS, MAX_PRICES, TABS } from './config.js';

export const state = { courses: [], results: {}, weather: {}, run: null, sel: null, csel: null, loaded: false };

// access is derived from tab in render(); it's kept here because the course filters read it.
export const pref = { tab: 'times', win: 'any', maxp: 0, best: 'dry', access: 'public', region: '', sort: 'rank', players: 2 };
const DEF = { ...pref };
try {
  const saved = JSON.parse(localStorage.getItem('teeprefs') || '{}');
  Object.assign(pref, saved);
  if (!saved.tab && saved.access === 'private') pref.tab = 'private'; // saved before tabs existed
} catch (e) {}

// Filters also live in the URL hash (#players=4&region=South+Sound) so a view can be shared; a link's filters win over saved ones.
const HASH = {
  tab: TABS, region: ['', ...REGIONS], sort: ['rank', 'dry', 'price'], players: ['1', '2', '3', '4'],
  win: ['any', 'am', 'mid', 'pm'], maxp: ['0', ...MAX_PRICES.map(String)], best: ['dry', 'price'],
};
export function readHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get('access') === 'private' && !h.has('tab')) pref.tab = 'private'; // links shared before tabs existed
  for (const k in HASH) { const v = h.get(k); if (v != null && HASH[k].includes(v)) pref[k] = typeof DEF[k] === 'number' ? Number(v) : v; }
}
export function writeHash() {
  const h = new URLSearchParams();
  for (const k in HASH) if (String(pref[k]) !== String(DEF[k])) h.set(k, pref[k]);
  const s = h.toString();
  history.replaceState(null, '', s ? '#' + s : location.pathname + location.search);
}
readHash();

export function savePref() { try { localStorage.setItem('teeprefs', JSON.stringify(pref)); } catch (e) {} writeHash(); }
