// About tab's course list: every course and how the dashboard treats it.
import { $, esc } from '../lib/dom.js';
import { isPub, hasTimes } from '../model/courses.js';
import { state } from '../state.js';

export function renderManage() {
  $('#ccount').textContent = `Courses · ${state.courses.filter(isPub).length} public · ${state.courses.filter(c => !isPub(c)).length} private`;
  $('#courses').innerHTML = state.courses.slice().sort((a, b) => a.name.localeCompare(b.name)).map(c => {
    const s = c.status !== 'ready' ? 'Set up next check' : c.active === false ? 'Paused' : isPub(c) ? (hasTimes(c) ? 'Live tee times' : 'Book direct') : 'Private';
    return `<button type="button" class="row chev" data-cd="${esc(c.id)}"><span class="grow">${esc(c.name)}<span class="sub">${esc(c.city || '')}</span></span><span class="val">${esc(s)}</span></button>`;
  }).join('');
}
