// Header status for golfers: "Updated 6:52 AM". A pill appears only when something affects them:
// offline, data more than a day old, or the last check failed. Run details live in About (manage.js).
import { $, esc } from '../lib/dom.js';
import { todayPT } from '../lib/dates.js';
import { state } from '../state.js';

// "6:52 AM" if today, else "Mon 7:56 PM".
export function when(iso) {
  const d = new Date(iso), today = d.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' }) === todayPT();
  return d.toLocaleString('en-US', { timeZone: 'America/Los_Angeles', ...(today ? {} : { weekday: 'short' }), hour: 'numeric', minute: '2-digit' });
}

export function renderStatus() {
  const r = state.run;
  if (!state.loaded) { $('#status').innerHTML = '<span>Loading…</span>'; return; }
  let pill = '';
  if (!navigator.onLine) pill = '<span class="pill stale"><i class="dot"></i>Offline · saved data</span>';
  else if (r?.finishedAt && Date.now() - new Date(r.finishedAt) > 26 * 3600e3) pill = '<span class="pill err"><i class="dot"></i>Not updated today</span>';
  else if (r?.status === 'error') pill = '<span class="pill err"><i class="dot"></i>Last check failed</span>';
  $('#status').innerHTML = pill + (r?.finishedAt ? `<span>Updated ${esc(when(r.finishedAt))}</span>` : '<span>No checks yet</span>');
}

export function showLoadError() { $('#status').innerHTML = '<span>Could not load the latest data. Refresh the page in a minute.</span>'; }
