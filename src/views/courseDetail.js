// Course sheet: ground today and the rain chart (3 days back + 7 ahead), drainage notes and sources, contact links.
import { $, esc } from '../lib/dom.js';
import { todayPT, shift, dLabel } from '../lib/dates.js';
import { showSheet, hideSheet } from '../lib/sheets.js';
import { isPub } from '../model/courses.js';
import { state } from '../state.js';
import { rainOn, rainPct, chance, bookLinkFor } from '../select.js';
import { wetTag, meter, frostText } from './ui.js';
import { restrictText, soakText } from '../model/soil.js';

// Where the drainage score came from.
function basis(dr) {
  if (dr.basis === 'soil') return 'From the USDA soil survey; no golfer reports found';
  if (dr.basis === 'blend') return `Golfer reports (${dr.researched}/5) averaged with the soil survey`;
  return dr.confidence ? `${dr.confidence[0].toUpperCase() + dr.confidence.slice(1)} confidence, from golfer reports` : '';
}

// Native soil around the course (USDA SSURGO), largest map units first.
function soilRows(soil) {
  if (!soil?.units?.length) return '';
  const desc = u => [u.drainage, u.group && 'group ' + u.group, u.flood && !/none/i.test(u.flood) && 'floods ' + u.flood.toLowerCase(),
    restrictText(u), soakText(u.ksat), u.slope != null && `${Math.round(u.slope)}% slope`].filter(Boolean).join(' · ') || 'Not rated';
  return soil.units.filter(u => u.share >= 0.1).map(u => `<div class="row"><span class="grow">${esc(u.name)}<span class="sub">${esc(desc(u))}</span></span><span class="val">${Math.round(u.share * 100)}%</span></div>`).join('') +
    `<a class="row chev" href="https://websoilsurvey.nrcs.usda.gov/" target="_blank" rel="noopener"><span class="grow">Native soil, before the course was built<span class="sub">USDA soil survey${soil.score != null ? ` · ${soil.score} of 5 on its own` : ''}</span></span></a>`;
}

export function renderCourseDetail() {
  const dlg = $('#cdetail'); const c = state.csel && state.courses.find(x => x.id === state.csel);
  if (!c) { hideSheet(dlg); return; }
  const dr = c.drainage || {}; const w = state.weather[c.id]; const t0 = todayPT();
  const span = [-3, -2, -1, 0, 1, 2, 3, 4, 5, 6].map(n => shift(t0, n)); const vals = span.map(d => rainOn(c, d)); const mx = Math.max(.5, ...vals);
  const book = isPub(c) && c.bookUrl ? bookLinkFor(c, t0) : null;
  const contact = [
    c.phone ? `<a class="row" href="tel:${esc(c.phone.replace(/[^\d+]/g, ''))}"><span class="grow">${isPub(c) ? 'Phone' : 'Pro shop'}</span><span class="val">${esc(c.phone)}</span></a>` : '',
    c.website ? `<a class="row chev" href="${esc(c.website)}" target="_blank" rel="noopener"><span class="grow">Website</span></a>` : '',
    book ? `<a class="row chev" href="${esc(book)}" target="_blank" rel="noopener"><span class="grow">Booking site</span></a>` : '',
  ].join('');
  showSheet(dlg, `<header class="sheet-head"><div><span class="label">${isPub(c) ? 'Public' : 'Private'} · ${esc(c.city || '')}${c.region ? ' · ' + esc(c.region) : ''}${c.rank ? ' · ranked #' + c.rank : ''}</span><h2 id="cdetail-title">${esc(c.name)}</h2></div><button type="button" class="sheet-done" data-dismiss>Done</button></header>
    <div class="sheet-body">
      <div>
        <div class="group-h">Ground</div>
        <div class="group">
          <div class="row"><span class="grow">Today</span>${wetTag(c, t0) || '<span class="val">No rain data</span>'}</div>
          <div class="row"><span class="grow">Tomorrow</span>${wetTag(c, shift(t0, 1)) || '<span class="val">—</span>'}</div>
          ${[[t0, 'Today'], [shift(t0, 1), 'Tomorrow']].filter(([d]) => frostText(c, d)).map(([d, l]) => `<div class="row"><span class="grow">Frost delay<span class="sub">${l}</span></span><span class="val">${esc(frostText(c, d))}</span></div>`).join('')}
          ${w ? `<div class="row stack"><div class="rainrow">${span.map((d, i) => { const p = d >= t0 ? rainPct(c, d) : null; return `<div title="${dLabel(d)}: ${vals[i].toFixed(2)} in${chance(c, d)}"><b class="${d >= t0 ? 'fc' : ''}" style="height:${Math.max(1, Math.round(vals[i] / mx * 30))}px"></b><small class="pct">${p == null ? '' : p + '%'}</small><small>${dLabel(d, true).slice(0, 2)}</small></div>`; }).join('')}</div>
            <div class="src"><span>${vals.slice(0, 3).reduce((a, b) => a + b, 0).toFixed(2)}" last 3 days</span><span>${vals.slice(3).reduce((a, b) => a + b, 0).toFixed(2)}" next 7 (dashed: forecast)</span></div></div>` : '<div class="row"><span class="sub">Rain data arrives with the next check</span></div>'}
        </div>
      </div>
      <div>
        <div class="group-h">Drainage</div>
        <div class="group">
          <div class="row"><span class="grow">${dr.score ? dr.score + ' of 5' : 'Unrated'}<span class="sub">${esc(basis(dr))}</span></span>${meter(dr.score)}</div>
          ${dr.basis === 'soil' ? '' : `<div class="row stack"><span>${esc(dr.summary || 'No drainage notes yet.')}</span>
            ${(dr.sources || []).length ? `<div class="src">${dr.sources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join('')}</div>` : ''}</div>`}
          ${soilRows(c.soil)}
        </div>
      </div>
      ${contact ? `<div class="group">${contact}</div>` : ''}
      ${c.note ? `<p class="note">${esc(c.note)}</p>` : ''}
    </div>`);
}
