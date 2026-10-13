// "Book Direct": public courses whose tee sheet can't be read. Tapping a row opens the course sheet.
import { $, esc } from '../lib/dom.js';
import { todayPT, shift } from '../lib/dates.js';
import { isPub, hasTimes } from '../model/courses.js';
import { state } from '../state.js';
import { sorted, bookLinkFor } from '../select.js';
import { wetTag, meter, listRow, listHead } from './ui.js';
import { drainSource } from '../model/soil.js';

const COLS = 'minmax(0,2.4fr) 96px 92px 92px 128px 110px';

export function renderBookDirect({ view }) {
  const lo = sorted(view.filter(c => isPub(c) && !hasTimes(c))); const t0 = todayPT();
  const el = $('#linkonly'); el.style.setProperty('--cols', COLS);
  el.innerHTML = lo.length ? listHead(['Course', 'Drainage', 'Today', 'Tomorrow', 'Phone', '']) + lo.map(c => listRow(c, `${esc(c.city || '')}${c.note ? ' · ' + esc(c.note) : ''}`, [
    `${meter(c.drainage?.score)}<div class="hint">${esc(drainSource(c.drainage, true))}</div>`,
    { today: true, html: wetTag(c, t0) || '<span class="hint">—</span>' },
    wetTag(c, shift(t0, 1)) || '<span class="hint">—</span>',
    `<span class="phone">${esc(c.phone || '')}</span>`,
    bookLinkFor(c, t0) ? `<a href="${esc(bookLinkFor(c, t0))}" target="_blank" rel="noopener">Booking site ↗</a>` : '',
  ])).join('') : `<div class="row"><span class="empty">${state.loaded ? 'None in this region.' : 'Loading…'}</span></div>`;
}
