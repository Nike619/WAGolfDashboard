// About tab: data freshness and run details (moved out of the header), and every course with how the
// dashboard treats it.
import { $, esc } from '../lib/dom.js';
import { ago } from '../lib/dates.js';
import { isPub, hasTimes } from '../model/courses.js';
import { state } from '../state.js';
import { when } from './status.js';

// GitHub links from the Pages URL (user.github.io/repo); null when previewing locally.
function github() {
  const m = location.hostname.match(/^([^.]+)\.github\.io$/i); if (!m) return null;
  return `https://github.com/${m[1]}/${location.pathname.split('/').filter(Boolean)[0] || m[1] + '.github.io'}`;
}

export function renderManage() {
  const r = state.run, gh = github(), wa = r?.weatherAt || Object.values(state.weather || {})[0]?.updatedAt;
  const status = { done: 'All courses checked', partial: 'Some courses couldn\'t be read', error: 'The check failed' }[r?.status] || '';
  $('#aboutdata').innerHTML = [
    `<div class="row"><span class="grow">Tee times checked${status ? `<span class="sub">${esc(status)}${r?.deferred ? ` · ${r.deferred} left for the next run` : ''}</span>` : ''}</span><span class="val">${r?.finishedAt ? esc(when(r.finishedAt)) : '—'}</span></div>`,
    r?.message ? `<div class="row"><span class="sub">${esc(r.message)}</span></div>` : '',
    `<div class="row"><span class="grow">Rain and forecast</span><span class="val">${wa ? esc(ago(wa)) : '—'}</span></div>`,
    `<div class="row"><span class="grow">Soil survey<span class="sub">USDA, refreshed by hand</span></span><span class="val">${state.soilsAt ? esc(new Date(state.soilsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })) : '—'}</span></div>`,
    gh ? `<a class="row chev" href="${gh}/actions/workflows/update.yml" target="_blank" rel="noopener"><span class="grow">Check for new times now<span class="sub">Opens GitHub Actions; press "Run workflow"</span></span></a>` : '',
  ].join('');
  if (gh) $('#editlink').href = gh + '/edit/main/data/courses.json';
  $('#ccount').textContent = `Courses · ${state.courses.filter(isPub).length} public · ${state.courses.filter(c => !isPub(c)).length} private`;
  $('#courses').innerHTML = state.courses.slice().sort((a, b) => a.name.localeCompare(b.name)).map(c => {
    const s = c.status !== 'ready' ? 'Set up next check' : c.active === false ? 'Paused' : isPub(c) ? (hasTimes(c) ? 'Live tee times' : 'Book direct') : 'Private';
    return `<button type="button" class="row chev" data-cd="${esc(c.id)}"><span class="grow">${esc(c.name)}<span class="sub">${esc(c.city || '')}</span></span><span class="val">${esc(s)}</span></button>`;
  }).join('');
}
