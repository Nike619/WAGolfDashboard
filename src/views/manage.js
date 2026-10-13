// "Manage courses": every course and how the dashboard treats it.
import { $, esc } from '../lib/dom.js';
import { isPub, hasTimes } from '../model/courses.js';
import { state } from '../state.js';

export function renderManage() {
  $('#ccount').textContent = `Manage courses (${state.courses.filter(isPub).length} public · ${state.courses.filter(c => !isPub(c)).length} private)`;
  $('#courses').innerHTML = state.courses.slice().sort((a, b) => a.name.localeCompare(b.name)).map(c => {
    const s = c.status !== 'ready' ? 'set up next check' : c.active === false ? 'paused' : isPub(c) ? (hasTimes(c) ? 'times' : 'link only') : 'private';
    return `<div class="mrow"><span title="${esc(c.name)}">${esc(c.name)} <span class="hint">· ${esc(s)}</span></span></div>`;
  }).join('');
}
