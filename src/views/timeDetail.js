// Panel under the tee sheet listing every open time for the selected course and day.
import { $, esc } from '../lib/dom.js';
import { dLabel, fmtT, ago } from '../lib/dates.js';
import { dataAt, lowestPrice } from '../model/teetimes.js';
import { state, pref } from '../state.js';
import { times, wet, chance, bookLinkFor } from '../select.js';

export function renderTimeDetail(priv) {
  const det = $('#detail');
  const c = state.sel && !priv && state.courses.find(x => x.id === state.sel.c), d = state.sel?.d, t = c && times(c.id, d);
  if (!c || t == null) { det.hidden = true; return; }
  det.hidden = false;
  const link = bookLinkFor(c, d); const min = lowestPrice(t); const w = wet(c, d);
  det.innerHTML = `<div class="detail-h"><div><span class="label">${dLabel(d)} · ${pref.players} players</span><h2>${esc(c.name)}</h2></div>${link ? `<a href="${esc(link)}" target="_blank" rel="noopener">Open booking page ↗</a>` : ''}</div>` +
    (t.length ? `<div class="times">${t.map(x => `<div class="t${x.p === min ? ' deal' : ''}"><span class="tt">${fmtT(x.t)}</span><span class="tp">${x.p != null ? '$' + x.p : ''}${x.s ? ` · ${x.s} spots` : ''}</span></div>`).join('')}</div>` : '<p class="empty">No times match your filters for this day.</p>') +
    (w ? `<p class="note">Ground: <span class="wet w-${w.key}"><i></i>${w.label}</span> · ${w.prior.toFixed(2)}" of rain in the 3 days before${w.day >= 0.01 ? `, ${w.day.toFixed(2)}" expected that day${esc(chance(c, d))}` : ', none expected that day'} · drainage ${c.drainage.score}/5</p>` : '') +
    `<p class="note">Times checked ${esc(ago(dataAt(state.results[c.id])))}. Times go fast; confirm on the booking page.${c.note ? ' ' + esc(c.note) : ''}</p>`;
}
