// Private club directory: ground conditions, rain totals and pro-shop phone.
import { $, esc } from '../lib/dom.js';
import { todayPT, shift } from '../lib/dates.js';
import { state } from '../state.js';
import { sorted, rainOn } from '../select.js';
import { wetTag, meter, courseName } from './ui.js';

export function renderPrivateClubs({ view }) {
  const t0 = todayPT(); const pc = sorted(view);
  $('#private').innerHTML = `<thead><tr><th>Club</th><th>Drainage</th><th>Today</th><th>Tomorrow</th><th>Rain, last 3 days</th><th>Next 3 days</th><th>Pro shop</th></tr></thead><tbody>` +
    (pc.map(c => {
      const prior = [-1, -2, -3].reduce((a, n) => a + rainOn(c, shift(t0, n)), 0), next = [0, 1, 2].reduce((a, n) => a + rainOn(c, shift(t0, n)), 0); const hw = !!state.weather[c.id];
      return `<tr><td>${courseName(c)}<div class="m">${esc(c.city || '')}${c.note ? ' · ' + esc(c.note) : ''}</div></td><td>${meter(c.drainage?.score)}<div class="hint">${esc(c.drainage?.confidence || '')}</div></td><td>${wetTag(c, t0) || '<span class="hint">—</span>'}</td><td>${wetTag(c, shift(t0, 1)) || '<span class="hint">—</span>'}</td><td class="num">${hw ? prior.toFixed(2) + '"' : '—'}</td><td class="num">${hw ? next.toFixed(2) + '"' : '—'}</td><td><span class="phone">${esc(c.phone || '')}</span>${c.website ? `<div><a href="${esc(c.website)}" target="_blank" rel="noopener" class="hint">Website ↗</a></div>` : ''}</td></tr>`;
    }).join('') || '<tr><td colspan="7" class="empty">No clubs in this region.</td></tr>') + '</tbody>';
}
