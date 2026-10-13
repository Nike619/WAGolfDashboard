// Filters: region, sort, players, tee-off window, max price; and the share button in the navigation bar.
// Wide screens show them inline. On phones a row of summary chips stands in for them, and tapping a chip
// moves the same controls into the Filters sheet (and back when it closes), so there's one set of controls.
import { $, setPressed, toast, esc } from '../lib/dom.js';
import { initSheet } from '../lib/sheets.js';
import { REGIONS, MAX_PRICES } from '../config.js';
import { pref, savePref, writeHash } from '../state.js';

const WIN = { any: 'Any time', am: 'Before 11', mid: '11–2', pm: 'After 2' };
const SORT = { rank: 'Ranking', dry: 'Driest', price: 'Cheapest', early: 'Earliest' };
const ICON = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 6h9M16 6h1M3 14h3M10 14h7"/><circle cx="14" cy="6" r="2"/><circle cx="8" cy="14" r="2"/></svg>';

export function initFilters(render) {
  $('#region').innerHTML = '<option value="">All of Washington</option>' + REGIONS.map(r => `<option>${r}</option>`).join('');
  $('#maxp').innerHTML = '<option value="0">No limit</option>' + MAX_PRICES.map(p => `<option value="${p}">$${p}</option>`).join('');
  const seg = (sel, apply) => $(sel).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; apply(b.dataset.v); savePref(); render(); });
  seg('#players', v => { pref.players = Number(v); });
  seg('#win', v => { pref.win = v; });
  $('#region').addEventListener('change', e => { pref.region = e.target.value; savePref(); render(); });
  $('#sort').addEventListener('change', e => { pref.sort = e.target.value; savePref(); render(); });
  $('#maxp').addEventListener('change', e => { pref.maxp = Number(e.target.value); savePref(); render(); });
  // Share this view (tab, day, filters are all in the URL): the system share sheet where there is one
  // (iPhone, Android), otherwise copy the link.
  $('#share').addEventListener('click', async () => {
    writeHash();
    if (navigator.share) { try { await navigator.share({ title: document.title, url: location.href }); } catch (e) {} return; }
    try { await navigator.clipboard.writeText(location.href); toast('Link copied. It opens with these filters.'); }
    catch (e) { toast('Copy the address bar to share this view.'); }
  });

  const filters = $('.filters'), home = document.createComment('filters'), dlg = $('#filtersheet');
  filters.before(home);
  $('#filterbar').addEventListener('click', e => {
    if (!e.target.closest('button')) return;
    $('#filterhost').append(filters); dlg.showModal();
  });
  initSheet(dlg, () => { home.after(filters); render(); });
}

export function renderFilters() {
  setPressed('#players button', v => Number(v) === pref.players);
  setPressed('#win button', v => v === pref.win);
  $('#maxp').value = String(pref.maxp); $('#region').value = pref.region; $('#sort').value = pref.sort;
  const chip = (label, on) => `<button type="button" class="chip${on ? ' on' : ''}">${esc(label)}</button>`;
  const times = pref.tab === 'times';
  $('#filterbar').innerHTML = `<button type="button" class="chip icon" aria-label="Filters">${ICON}</button>` +
    chip(pref.region || 'All of Washington', !!pref.region) +
    (times ? chip(`${pref.players} ${pref.players === 1 ? 'player' : 'players'}`, pref.players !== 2) + chip(WIN[pref.win], pref.win !== 'any') + chip(pref.maxp ? `Up to $${pref.maxp}` : 'Any price', !!pref.maxp) : '') +
    (pref.tab === 'map' ? '' : chip(SORT[pref.sort], pref.sort !== 'rank'));
}
