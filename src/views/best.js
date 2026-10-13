// "Driest course each day" / "Cheapest each day" strip.
import { $, esc, setPressed } from '../lib/dom.js';
import { dLabel, fmtT } from '../lib/dates.js';
import { lowestPrice } from '../model/teetimes.js';
import { dryKey } from '../model/ground.js';
import { state, pref } from '../state.js';
import { times, wet } from '../select.js';
import { wetTag } from './ui.js';

export function initBest(render, { showCourse, showTimes }) {
  $('#best').addEventListener('click', e => {
    const b = e.target.closest('button.bday'); if (!b) return;
    if (pref.access === 'private') { showCourse(b.dataset.c); return; }
    showTimes(b.dataset.c, b.dataset.d);
  });
}

export function renderBest({ priv, view, sheetCs, dates, minBy }) {
  const mode = priv ? 'dry' : pref.best;
  setPressed('#bestmode button', v => v === mode);
  $('#besth').textContent = priv ? 'Driest private club each day' : mode === 'dry' ? 'Driest course each day' : 'Cheapest each day';
  const none = d => `<div class="bday none"><span class="d">${dLabel(d)}</span><span class="p num">—</span><span class="c">Nothing matches</span></div>`;
  if (mode === 'dry') {
    const pool = priv ? view : sheetCs;
    $('#best').innerHTML = dates.map(d => {
      let best = null;
      pool.forEach(c => {
        let n = null, cheap = Infinity;
        if (!priv) { const t = times(c.id, d); if (!t || !t.length) return; n = t.length; cheap = lowestPrice(t); }
        const w = wet(c, d); const score = dryKey(w, c.drainage?.score);
        if (!best || score < best.score - 0.001 || (Math.abs(score - best.score) <= 0.001 && ((c.drainage?.score || 0) > (best.c.drainage?.score || 0) || cheap < best.cheap))) best = { c, score, w, cheap, n };
      });
      return best ? `<button type="button" class="bday" data-c="${esc(best.c.id)}" data-d="${d}"><span class="d">${dLabel(d)}</span><span class="p" style="font-family:var(--display);font-size:19px;font-weight:600;color:var(--ink);line-height:1.1">${esc(best.c.name)}</span><span class="c">${best.w ? `<span class="wet w-${best.w.key}"><i></i>${best.w.label}</span> · ` : ''}${priv ? esc(best.c.city) : best.n + (best.n === 1 ? ' time' : ' times') + (isFinite(best.cheap) ? ' from $' + best.cheap : '')}</span></button>` : none(d);
    }).join('');
    $('#bestnote').textContent = priv ? `${view.length} private clubs${pref.region ? ' in ' + pref.region : ''} · drainage score + recent rain` : `Among ${sheetCs.length} courses with open times for ${pref.players}${pref.region ? ' in ' + pref.region : ''} · drainage score + recent rain`;
  } else {
    $('#best').innerHTML = dates.map(d => { const b = minBy[d]; return b ? `<button type="button" class="bday" data-c="${esc(b.c.id)}" data-d="${d}"><span class="d">${dLabel(d)}</span><span class="p num">$${b.p}</span><span class="c">${esc(b.c.name)} · ${fmtT(b.t)} ${wetTag(b.c, d)}</span></button>` : none(d); }).join('');
    $('#bestnote').textContent = `${pref.players} players · per-player rate`;
  }
}
