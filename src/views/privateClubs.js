// Private club directory: ground conditions, rain totals and pro-shop phone. Tapping a row opens the club's sheet.
import { $, esc } from '../lib/dom.js';
import { todayPT, shift } from '../lib/dates.js';
import { state } from '../state.js';
import { sorted, rainOn } from '../select.js';
import { wetTag, meter, listRow, listHead } from './ui.js';

const COLS = 'minmax(0,2.4fr) 96px 92px 92px 92px 92px 128px';

export function renderPrivateClubs({ view }) {
  const t0 = todayPT(); const pc = sorted(view);
  const el = $('#private'); el.style.setProperty('--cols', COLS);
  el.innerHTML = pc.length ? listHead(['Club', 'Drainage', 'Today', 'Tomorrow', 'Last 3 days', 'Next 3 days', 'Pro shop']) + pc.map(c => {
    const prior = [-1, -2, -3].reduce((a, n) => a + rainOn(c, shift(t0, n)), 0), next = [0, 1, 2].reduce((a, n) => a + rainOn(c, shift(t0, n)), 0); const hw = !!state.weather[c.id];
    return listRow(c, `${esc(c.city || '')}${c.note ? ' · ' + esc(c.note) : ''}`, [
      `${meter(c.drainage?.score)}<div class="hint">${esc(c.drainage?.basis === 'soil' ? 'soil survey' : c.drainage?.confidence || '')}</div>`,
      { today: true, html: wetTag(c, t0) || '<span class="hint">—</span>' },
      wetTag(c, shift(t0, 1)) || '<span class="hint">—</span>',
      `<span class="num">${hw ? prior.toFixed(2) + '"' : '—'}</span>`,
      `<span class="num">${hw ? next.toFixed(2) + '"' : '—'}</span>`,
      `<span class="phone">${esc(c.phone || '')}</span>`,
    ]);
  }).join('') : `<div class="row"><span class="empty">${state.loaded ? 'No clubs in this region.' : 'Loading…'}</span></div>`;
}
