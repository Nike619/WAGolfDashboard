// Tee Times, day view: one row per course with open times on the picked day, sorted by pref.sort.
// Each row: name, city, ground and any frost that affects its times; on the right the earliest time and
// "N times · from $X". Courses with nothing that day are listed by name in one row at the end.
// Tapping a row opens the tee-time sheet.
import { $, esc } from '../lib/dom.js';
import { dayName, fmtT } from '../lib/dates.js';
import { lowestPrice, earliest } from '../model/teetimes.js';
import { state, pref, writeHash } from '../state.js';
import { times, sorted, frost } from '../select.js';
import { wetTag, rankTag, badge, frostWhen } from './ui.js';

export function initDayList(render, { showTimes }) {
  $('#daylist').addEventListener('click', e => {
    const b = e.target.closest('button.drow'); if (b) { showTimes(b.dataset.c, b.dataset.d); return; }
    const n = e.target.closest('[data-day]'); if (n) { state.day = n.dataset.day; writeHash(); render(); }
  });
}

export function renderDayList({ sheetCs, day, dates }) {
  const open = [], none = [];
  for (const c of sorted(sheetCs, day)) {
    const t = times(c.id, day);
    (t && t.length ? open : none).push({ c, t });
  }
  const total = open.reduce((a, x) => a + x.t.length, 0);
  $('#dayh').textContent = dayName(day);
  $('#daynote').textContent = state.loaded ? `${open.length} ${open.length === 1 ? 'course' : 'courses'} · ${total} open ${total === 1 ? 'time' : 'times'} for ${pref.players}` : '';
  const rows = open.map(({ c, t }) => {
    const first = earliest(t), p = lowestPrice(t), thaw = frost(c, day);
    const frosty = thaw && first < thaw ? `<span class="frost">Frost ${frostWhen(thaw)}</span>` : '';
    return `<button type="button" class="drow" data-c="${esc(c.id)}" data-d="${day}">
      <span class="dmain"><span class="nm">${rankTag(c)}${esc(c.name)}</span><span class="sub">${esc(c.city || '')}${wetTag(c, day) ? ' · ' + wetTag(c, day) : ''}${frosty ? ' · ' + frosty : ''}${badge(state.results[c.id])}</span></span>
      <span class="dside"><span class="dt">${fmtT(first)}</span><span class="sub">${t.length} ${t.length === 1 ? 'time' : 'times'}${isFinite(p) ? ' · from $' + p : ''}</span></span>
    </button>`;
  }).join('');
  // Courses with nothing that day: one expandable row, not a wall of names.
  const rest = none.length && open.length ? `<details class="row more"><summary>${none.length} more ${none.length === 1 ? 'course has' : 'courses have'} no matching times</summary><span class="sub">${none.map(x => esc(x.c.name)).join(', ')}</span></details>` : '';
  // A day with nothing at all: say so, and point to the next day that has times.
  const next = dates.find(d => d > day && sheetCs.some(c => (times(c.id, d) || []).length));
  const empty = !state.loaded ? 'Loading…' : !sheetCs.length ? 'No courses with online tee times in this region.'
    : `No open times match your filters ${dayName(day) === 'Today' ? 'for the rest of today' : 'on ' + dayName(day)}.${next ? ` <button type="button" class="linkbtn" data-day="${next}">See ${dayName(next).toLowerCase() === 'tomorrow' ? 'tomorrow' : dayName(next)}</button>` : ''}`;
  $('#daylist').innerHTML = open.length ? rows + rest : `<div class="row"><span class="empty">${empty}</span></div>`;
}
