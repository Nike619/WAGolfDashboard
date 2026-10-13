// Small HTML fragments several views share.
import { esc } from '../lib/dom.js';
import { ago } from '../lib/dates.js';
import { dataAt, isStale } from '../model/teetimes.js';
import { wet, chance } from '../select.js';

export const wetTag = (c, d, suffix = '') => {
  const x = wet(c, d);
  return x ? `<span class="wet w-${x.key}" title="${x.day.toFixed(2)} in that day${chance(c, d)} · ${x.prior.toFixed(2)} in the 3 days before"><i></i>${x.label}${suffix}</span>` : '';
};
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
