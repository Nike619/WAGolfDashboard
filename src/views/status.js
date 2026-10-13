// Header status: last run, its outcome, and stale-data warnings.
import { $, esc } from '../lib/dom.js';
import { ago } from '../lib/dates.js';
import { state } from '../state.js';

export function renderStatus() {
  const r = state.run;
  let pill = '';
  if (!state.loaded) pill = '';
  else if (!navigator.onLine) pill = '<span class="pill stale"><i class="dot"></i>Offline · saved data</span>';
  else if (r?.finishedAt && Date.now() - new Date(r.finishedAt) > 26 * 3600e3) pill = '<span class="pill err"><i class="dot"></i>Not updated today</span>';
  else if (r?.status === 'partial') pill = '<span class="pill stale"><i class="dot"></i>Partly updated</span>';
  else if (r?.status === 'error') pill = '<span class="pill err"><i class="dot"></i>Last check had problems</span>';
  else if (r?.finishedAt) pill = '<span class="pill ok"><i class="dot"></i>Up to date</span>';
  const wa = r?.weatherAt || Object.values(state.weather || {})[0]?.updatedAt;
  $('#status').innerHTML = pill +
    (r?.finishedAt ? `<span>Last checked <b>${esc(ago(r.finishedAt))}</b> · ${new Date(r.finishedAt).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</span>` : '<span>No checks yet</span>') +
    (r?.message ? `<span>${esc(r.message)}</span>` : '') +
    (wa && Date.now() - new Date(wa) > 18 * 3600e3 ? `<span>Rain data from ${esc(ago(wa))}</span>` : '');
}

export function showLoadError() { $('#status').innerHTML = '<span>Could not load the latest data. Refresh the page in a minute.</span>'; }
