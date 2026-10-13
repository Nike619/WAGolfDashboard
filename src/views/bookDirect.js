// "Book directly": public courses whose tee sheet can't be read.
import { $, esc } from '../lib/dom.js';
import { todayPT, shift } from '../lib/dates.js';
import { isPub, hasTimes } from '../model/courses.js';
import { sorted, bookLinkFor } from '../select.js';
import { wetTag, meter, courseName } from './ui.js';

export function renderBookDirect({ view }) {
  const lo = sorted(view.filter(c => isPub(c) && !hasTimes(c))); const t0 = todayPT();
  $('#linkonly').innerHTML = `<thead><tr><th>Course</th><th>Drainage</th><th>Today</th><th>Tomorrow</th><th>Phone</th><th></th></tr></thead><tbody>` +
    (lo.map(c => `<tr><td>${courseName(c)}<div class="m">${esc(c.city || '')}${c.note ? ' · ' + esc(c.note) : ''}</div></td><td>${meter(c.drainage?.score)}</td><td>${wetTag(c, t0) || '<span class="hint">—</span>'}</td><td>${wetTag(c, shift(t0, 1)) || '<span class="hint">—</span>'}</td><td><span class="phone">${esc(c.phone || '')}</span></td><td>${bookLinkFor(c, t0) ? `<a href="${esc(bookLinkFor(c, t0))}" target="_blank" rel="noopener">Booking site ↗</a>` : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">None in this region.</td></tr>') + '</tbody>';
}
