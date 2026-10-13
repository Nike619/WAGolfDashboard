// Filter bar: region, sort, players, tee-off window, max price, share link.
import { $, setPressed, toast } from '../lib/dom.js';
import { REGIONS, MAX_PRICES } from '../config.js';
import { pref, savePref, writeHash } from '../state.js';

export function initFilters(render) {
  $('#region').innerHTML = '<option value="">All of Washington</option>' + REGIONS.map(r => `<option>${r}</option>`).join('');
  $('#maxp').innerHTML = '<option value="0">No limit</option>' + MAX_PRICES.map(p => `<option value="${p}">$${p}</option>`).join('');
  const seg = (sel, apply) => $(sel).addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; apply(b.dataset.v); savePref(); render(); });
  seg('#players', v => { pref.players = Number(v); });
  seg('#win', v => { pref.win = v; });
  seg('#bestmode', v => { pref.best = v; });
  $('#region').addEventListener('change', e => { pref.region = e.target.value; savePref(); render(); });
  $('#sort').addEventListener('change', e => { pref.sort = e.target.value; savePref(); render(); });
  $('#maxp').addEventListener('change', e => { pref.maxp = Number(e.target.value); savePref(); render(); });
  $('#share').addEventListener('click', async () => {
    writeHash();
    try { await navigator.clipboard.writeText(location.href); toast('Link copied. It opens with these filters.'); }
    catch (e) { toast('Copy the address bar to share this view.'); }
  });
}

export function renderFilters() {
  setPressed('#players button', v => Number(v) === pref.players);
  setPressed('#win button', v => v === pref.win);
  $('#maxp').value = String(pref.maxp); $('#region').value = pref.region; $('#sort').value = pref.sort;
}
