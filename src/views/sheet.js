// The tee sheet: one row per course with readable times, one cell per day.
import { $, esc } from '../lib/dom.js';
import { dLabel, dNum, nowPT } from '../lib/dates.js';
import { isStale, lowestPrice } from '../model/teetimes.js';
import { state } from '../state.js';
import { times } from '../select.js';
import { wetTag, courseName, badge } from './ui.js';

export function initSheet(render, { showTimes }) {
  $('#sheet').addEventListener('click', e => {
    const b = e.target.closest('button.cell'); if (!b) return;
    const s = state.sel;
    if (s && s.c === b.dataset.c && s.d === b.dataset.d) { state.sel = null; render(); }
    else showTimes(b.dataset.c, b.dataset.d);
  });
}

export function renderSheet({ sheetCs, dates, minBy }) {
  const head = `<thead><tr><th>Course</th>${dates.map(d => `<th>${dLabel(d, true)}<small>${dNum(d)}</small></th>`).join('')}</tr></thead>`;
  const body = sheetCs.map(c => {
    const res = state.results[c.id]; const old = !!res && isStale(res);
    return `<tr><th class="course" scope="row">${courseName(c)}<div class="m">${esc(c.city || '')}${badge(res)}</div></th>` +
      dates.map(d => {
        const t = times(c.id, d);
        if (t == null) return `<td><div class="cell na">not checked${wetTag(c, d) ? '<br>' + wetTag(c, d) : ''}</div></td>`;
        const n = t.length, min = n ? lowestPrice(t) : null; const cheap = n && minBy[d] && min === minBy[d].p;
        const sel = state.sel && state.sel.c === c.id && state.sel.d === d;
        return `<td><button type="button" class="cell${n ? '' : ' zero'}${n && n <= 3 ? ' low' : ''}${cheap ? ' cheapest' : ''}${old ? ' old' : ''}" data-c="${esc(c.id)}" data-d="${d}" aria-pressed="${sel}" aria-label="${esc(c.name)} ${dLabel(d)}: ${n} times"><span class="cnt">${n}</span><span class="from">${n && isFinite(min) ? 'from $' + min : n ? 'open' : d === nowPT().d ? 'none left' : 'full'}</span>${wetTag(c, d)}</button></td>`;
      }).join('') + '</tr>';
  }).join('');
  $('#sheet').innerHTML = head + '<tbody>' + (body || `<tr><td colspan="${dates.length + 1}" style="padding:24px;text-align:center" class="empty">No courses with online tee times in this region.</td></tr>`) + '</tbody>';
}
