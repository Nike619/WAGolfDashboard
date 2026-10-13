// Tee Times, week view: one row per course, one cell per day with the lowest price and the time of that
// slot, a ground dot and ❄ for frost. The lowest price of each day across courses is bold.
import { $, esc } from '../lib/dom.js';
import { dLabel, dNum, nowPT, fmtT } from '../lib/dates.js';
import { isStale, lowestPrice, cheapest, earliest } from '../model/teetimes.js';
import { state } from '../state.js';
import { times, frost, wet } from '../select.js';
import { courseName, badge, frostWhen } from './ui.js';

// Ground as a small colored dot (word in the tooltip), and ❄ when a frost delay is likely.
const marks = (c, d) => { const w = wet(c, d), f = frost(c, d); return `<span class="marks">${w ? `<i class="gdot w-${w.key}" title="${w.label}"></i>` : ''}${f ? `<span class="frost" title="Frost delay likely ${frostWhen(f)}">❄</span>` : ''}</span>`; };

export function initTeeSheet(render, { showTimes }) {
  $('#sheet').addEventListener('click', e => {
    const b = e.target.closest('button.cell'); if (!b) return;
    const s = state.sel;
    if (s && s.c === b.dataset.c && s.d === b.dataset.d) { state.sel = null; render(); }
    else showTimes(b.dataset.c, b.dataset.d);
  });
}

export function renderTeeSheet({ sheetCs, dates, minBy }) {
  const head = `<thead><tr><th>Course</th>${dates.map(d => d === nowPT().d ? `<th class="today">Today<small>${dNum(d)}</small></th>` : `<th>${dLabel(d, true)}<small>${dNum(d)}</small></th>`).join('')}</tr></thead>`;
  const body = sheetCs.map(c => {
    const res = state.results[c.id]; const old = !!res && isStale(res);
    return `<tr><th class="course" scope="row">${courseName(c)}<div class="m">${esc(c.city || '')}${badge(res)}</div></th>` +
      dates.map(d => {
        const t = times(c.id, d);
        if (t == null) return `<td><div class="cell na">—${marks(c, d)}</div></td>`;
        const n = t.length, min = n ? lowestPrice(t) : null, low = n ? cheapest(t) : null; const cheap = n && minBy[d] && min === minBy[d].p;
        const sel = state.sel && state.sel.c === c.id && state.sel.d === d;
        const big = low ? '$' + low.p : n ? 'Open' : '—', small = low ? fmtT(low.t) : n ? fmtT(earliest(t)) : '';
        return `<td><button type="button" class="cell${n ? '' : ' zero'}${n && n <= 3 ? ' low' : ''}${cheap ? ' cheapest' : ''}${old ? ' old' : ''}" data-c="${esc(c.id)}" data-d="${d}" aria-pressed="${sel}" aria-label="${esc(c.name)} ${dLabel(d)}: ${n ? (low ? 'from $' + low.p + ' at ' + fmtT(low.t) : n + ' times') : 'no times'}"><span class="cnt">${big}</span><span class="from">${small}</span>${marks(c, d)}</button></td>`;
      }).join('') + '</tr>';
  }).join('');
  $('#sheet').innerHTML = head + '<tbody>' + (body || `<tr><td colspan="${dates.length + 1}" style="padding:24px;text-align:center" class="empty">No courses with online tee times in this region.</td></tr>`) + '</tbody>';
}
