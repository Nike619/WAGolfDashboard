// Sheet listing every open time for the selected course and day.
import { $, esc } from '../lib/dom.js';
import { dLabel, fmtT, ago } from '../lib/dates.js';
import { showSheet, hideSheet } from '../lib/sheets.js';
import { dataAt, lowestPrice } from '../model/teetimes.js';
import { state, pref } from '../state.js';
import { times, wet, chance, bookLinkFor, sunset } from '../select.js';

export function renderTimeDetail(priv) {
  const dlg = $('#detail');
  const c = state.sel && !priv && state.courses.find(x => x.id === state.sel.c), d = state.sel?.d, t = c && times(c.id, d);
  if (!c || t == null) { hideSheet(dlg); return; }
  const link = bookLinkFor(c, d), dusk = sunset(c, d), w = wet(c, d);
  // Only highlight the cheapest time when prices differ.
  const min = lowestPrice(t), varied = t.some(x => x.p != null && x.p !== min);
  showSheet(dlg, `<header class="sheet-head"><div><span class="label">${dLabel(d)} · ${pref.players} ${pref.players === 1 ? 'player' : 'players'}</span><h2 id="detail-title">${esc(c.name)}</h2></div><button type="button" class="sheet-done" data-dismiss>Done</button></header>
    <div class="sheet-body">
      ${link ? `<a class="bigbtn" href="${esc(link)}" target="_blank" rel="noopener">Book on the course site ↗</a>` : ''}
      ${t.length ? `<div class="times">${t.map(x => `<div class="t${varied && x.p === min ? ' deal' : ''}"><span class="tt">${fmtT(x.t)}</span><span class="tp">${x.p != null ? '$' + x.p : ''}${x.s ? ` · ${x.s} ${x.s === 1 ? 'spot' : 'spots'}` : ''}</span></div>`).join('')}</div>` : '<p class="empty">No times match your filters for this day.</p>'}
      <div class="group">
        ${w ? `<div class="row"><span class="grow">Ground</span><span class="wet w-${w.key}"><i></i>${w.label}</span></div>
        <div class="row"><span class="grow">Rain, 3 days before</span><span class="val">${w.prior.toFixed(2)}"</span></div>
        <div class="row"><span class="grow">Rain that day</span><span class="val">${w.day >= 0.01 ? `${w.day.toFixed(2)}"${esc(chance(c, d))}` : 'None expected'}</span></div>
        <div class="row"><span class="grow">Drainage</span><span class="val">${c.drainage.score}/5</span></div>` : ''}
        ${dusk ? `<div class="row"><span class="grow">Sunset</span><span class="val">${fmtT(dusk)}</span></div>` : ''}
        <button type="button" class="row chev" data-cd="${esc(c.id)}"><span class="grow">Course details</span></button>
      </div>
      <p class="note">Times checked ${esc(ago(dataAt(state.results[c.id])))}. Times go fast; confirm on the booking page.${c.note ? ' ' + esc(c.note) : ''}</p>
    </div>`);
}
