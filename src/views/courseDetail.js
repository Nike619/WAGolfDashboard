// Course panel: drainage notes and sources, contact links, rain chart for 3 days back + 7 ahead.
import { $, esc } from '../lib/dom.js';
import { todayPT, shift, dLabel } from '../lib/dates.js';
import { isPub } from '../model/courses.js';
import { state } from '../state.js';
import { rainOn, rainPct, chance, bookLinkFor } from '../select.js';
import { wetTag, meter } from './ui.js';

export function renderCourseDetail() {
  const cd = $('#cdetail'); const c = state.csel && state.courses.find(x => x.id === state.csel);
  if (!c) { cd.hidden = true; return; }
  cd.hidden = false;
  const dr = c.drainage || {}; const w = state.weather[c.id]; const t0 = todayPT();
  const span = [-3, -2, -1, 0, 1, 2, 3, 4, 5, 6].map(n => shift(t0, n)); const vals = span.map(d => rainOn(c, d)); const mx = Math.max(.5, ...vals);
  cd.innerHTML = `<div class="detail-h"><div><span class="label">${isPub(c) ? 'Public' : 'Private'} · ${esc(c.city || '')}${c.region ? ' · ' + esc(c.region) : ''}${c.rank ? ' · ranked #' + c.rank : ''}</span><h2>${esc(c.name)}</h2></div><button type="button" class="linkbtn" data-close>Close</button></div>
      <div class="cdet"><div style="display:flex;flex-direction:column;gap:8px"><div style="display:flex;gap:10px;align-items:center">${meter(dr.score)}<span class="label">Drainage ${dr.score ? dr.score + '/5' : 'unrated'}${dr.confidence ? ' · ' + esc(dr.confidence) + ' confidence' : ''}</span></div>
        <p style="margin:0">${esc(dr.summary || 'No drainage notes yet.')}</p>
        ${(dr.sources || []).length ? `<div class="src">${dr.sources.map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join('')}</div>` : ''}
        <div class="src">${c.phone ? `<span class="phone">${esc(c.phone)}</span>` : ''}${c.website ? `<a href="${esc(c.website)}" target="_blank" rel="noopener">Website ↗</a>` : ''}${isPub(c) && c.bookUrl ? `<a href="${esc(bookLinkFor(c, t0))}" target="_blank" rel="noopener">Booking ↗</a>` : ''}</div></div>
      <div style="display:flex;flex-direction:column;gap:6px"><span class="label">Rain (in) · last 3 days, then forecast ${wetTag(c, t0, ' today')}</span>
        ${w ? `<div class="rainrow">${span.map((d, i) => { const p = d >= t0 ? rainPct(c, d) : null; return `<div title="${dLabel(d)}: ${vals[i].toFixed(2)} in${chance(c, d)}"><b class="${d >= t0 ? 'fc' : ''}" style="height:${Math.max(1, Math.round(vals[i] / mx * 30))}px"></b><small class="pct">${p == null ? '' : p + '%'}</small><small>${dLabel(d, true).slice(0, 2)}</small></div>`; }).join('')}</div>
        <div class="src"><span>${vals.slice(0, 3).reduce((a, b) => a + b, 0).toFixed(2)}" last 3 days</span><span>${vals.slice(3).reduce((a, b) => a + b, 0).toFixed(2)}" next 7</span></div>` : '<div class="src">Rain data arrives with the next check</div>'}</div></div>`;
}
