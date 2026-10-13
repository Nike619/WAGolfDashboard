// Small HTML fragments several views share.
import { esc } from '../lib/dom.js';
import { ago } from '../lib/dates.js';
import { dataAt, isStale } from '../model/teetimes.js';
import { wet, chance, frost, low } from '../select.js';
import { fmtT } from '../lib/dates.js';

export const wetTag = (c, d, suffix = '') => {
  const x = wet(c, d);
  if (!x) return '';
  const tip = x.key === 'snow' ? `${x.snow} in of snow on the ground` : `${x.day.toFixed(2)} in that day${chance(c, d)} · ${x.prior.toFixed(2)} in the 3 days before${x.dried >= 0.01 ? ` · ${x.dried.toFixed(2)} in dried by sun and wind` : ''}`;
  return `<span class="wet w-${x.key}" title="${tip}"><i></i>${x.label}${suffix}</span>`;
};
// Drainage score in words, e.g. "Drains fast".
export const drainWords = s => ({ 5: 'Drains very fast', 4: 'Drains fast', 3: 'Drains moderately', 2: 'Drains slowly', 1: 'Drains very slowly' })[s] || 'Drainage unknown';
// "until 10:00 AM" / "all day" for a frost-until time.
export const frostWhen = f => f === '24:00' ? 'all day' : 'until ' + fmtT(f);
// Frost delay line for a course and day, e.g. "Likely until 10:00 AM · low 28°F", or ''.
export const frostText = (c, d) => { const f = frost(c, d); if (!f) return ''; const l = low(c, d); return `Likely ${frostWhen(f)}${l != null ? ` · low ${l}°F` : ''}`; };
export const meter = s => `<div class="meter" aria-label="Drainage ${s || '?'} of 5">${[1, 2, 3, 4, 5].map(i => `<span class="${i <= (s || 0) ? 'on' : ''}"></span>`).join('')}</div>`;
export const rankTag = c => c.rank ? `<span class="rank">#${c.rank}</span>` : '';
export const courseName = c => `<div class="n">${rankTag(c)}<button type="button" data-cd="${esc(c.id)}">${esc(c.name)}</button></div>`;

// One row in a course list. cells: HTML strings (or { today: true, html }) shown as extra columns on wide
// screens; the "today" cell also shows on phones. The name button covers the row, so a tap anywhere opens the course.
export const listRow = (c, sub, cells) => `<div class="lrow"><button type="button" class="lmain" data-cd="${esc(c.id)}"><span class="nm">${rankTag(c)}${esc(c.name)}</span><span class="sub">${sub}</span></button>${cells.map(x => typeof x === 'string' ? `<span class="lc">${x}</span>` : `<span class="lc today">${x.html}</span>`).join('')}</div>`;
export const listHead = labels => `<div class="lrow lhead" aria-hidden="true">${labels.map((l, i) => `<span class="${i ? 'lc' : ''}">${l}</span>`).join('')}</div>`;

// Why a course's times might be missing or old.
export function badge(res) {
  if (!res) return '';
  if (res.ok === false) return ` <span class="pill err" title="${esc(res.error || '')}">Check failed${dataAt(res) ? ' · times from ' + esc(ago(dataAt(res))) : ''}</span>`;
  if (isStale(res)) return ` <span class="pill stale">Times from ${esc(ago(dataAt(res)))}</span>`;
  if (res.warning) return ` <span class="pill stale" title="${esc(res.warning)}">No times all week</span>`;
  return '';
}
