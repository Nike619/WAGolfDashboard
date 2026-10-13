// The strip of 7 days above the list.
// Tee Times: each day shows the cheapest tee time that matches the filters (price, course, time); tapping one
// picks the day.
// Private: the driest club each day; tapping one opens that club.
import { $, esc } from '../lib/dom.js';
import { dayName, fmtT } from '../lib/dates.js';
import { dryKey } from '../model/ground.js';
import { state, pref, savePref } from '../state.js';
import { times, wet } from '../select.js';

export function initDayPicker(render, { showCourse }) {
  $('#days').addEventListener('click', e => {
    const b = e.target.closest('button.bday'); if (!b) return;
    if (pref.tab === 'private') { showCourse(b.dataset.c); return; }
    state.day = b.dataset.d; pref.view = 'day'; savePref(); render();
  });
}

export function renderDayPicker({ priv, view, sheetCs, dates, day, minBy }) {
  $('#daysh').textContent = priv ? 'Driest private club each day' : '';
  $('#daysh').hidden = !priv;
  if (priv) {
    $('#days').innerHTML = dates.map(d => {
      let best = null;
      for (const c of view) {
        const w = wet(c, d), score = dryKey(w, c.drainage?.score);
        if (!best || score < best.score - 0.001 || (Math.abs(score - best.score) <= 0.001 && (c.drainage?.score || 0) > (best.c.drainage?.score || 0))) best = { c, score, w };
      }
      return best ? `<button type="button" class="bday" data-c="${esc(best.c.id)}" data-d="${d}"><span class="d">${dayName(d)}</span><span class="nm">${esc(best.c.name)}</span><span class="c">${best.w ? `<span class="wet w-${best.w.key}"><i></i>${best.w.label}</span> · ` : ''}${esc(best.c.city || '')}</span></button>` : '';
    }).join('');
    return;
  }
  $('#days').innerHTML = dates.map(d => {
    const any = sheetCs.some(c => (times(c.id, d) || []).length), b = minBy[d];
    const on = pref.view === 'day' && d === day;
    const big = b ? '$' + b.p : any ? 'Open' : '—';
    const small = b ? `${esc(b.c.name)} · ${fmtT(b.t)}` : any ? 'Prices on booking sites' : 'No times';
    return `<button type="button" class="bday pick${on ? ' on' : ''}${any ? '' : ' none'}" data-d="${d}" aria-pressed="${on}"><span class="d">${dayName(d)}</span><span class="p">${big}</span><span class="c">${small}</span></button>`;
  }).join('');
}
