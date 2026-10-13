// Tab bar (Tee Times · Map · Book Direct · Private · About), the large title, and which sections each tab shows.
// Elements with data-tabs="times private" are shown only on those tabs.
import { $, $$ } from '../lib/dom.js';
import { state, pref, savePref } from '../state.js';

const ICONS = {
  times: '<path d="M7 21V3.5"/><path d="M7 4l10 3.6L7 11.2"/><path d="M3.5 21h7"/>',
  map: '<path d="M9 4.5 3.5 6.6v13l5.5-2.1 6 2.1 5.5-2.1v-13L15 6.6z"/><path d="M9 4.5v13M15 6.6v13"/>',
  direct: '<path d="M6.6 3.5h2.8l1.6 4.3-2.1 1.4a11.5 11.5 0 0 0 5.9 5.9l1.4-2.1 4.3 1.6v2.8a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z"/>',
  private: '<rect x="5" y="10.5" width="14" height="10" rx="2.2"/><path d="M8.2 10.5V7.8a3.8 3.8 0 0 1 7.6 0v2.7"/>',
  about: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><path d="M12 7.6v.1"/>',
};
const TAB_INFO = {
  times: { label: 'Tee Times', title: 'Tee Times' },
  map: { label: 'Map', title: 'Map' },
  direct: { label: 'Book Direct', title: 'Book Direct' },
  private: { label: 'Private', title: 'Private Clubs' },
  about: { label: 'About', title: 'About' },
};

export function initTabs(render) {
  $('#tabbar').innerHTML = Object.entries(TAB_INFO).map(([id, t]) =>
    `<button type="button" data-tab="${id}"><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[id]}</svg><span>${t.label}</span></button>`).join('');
  $('#tabbar').addEventListener('click', e => {
    const b = e.target.closest('button[data-tab]'); if (!b) return;
    if (b.dataset.tab === pref.tab) { window.scrollTo({ top: 0, behavior: 'smooth' }); return; } // tapping the current tab scrolls to top, as on iOS
    pref.tab = b.dataset.tab; state.sel = null; state.csel = null; savePref(); render();
    window.scrollTo({ top: 0 });
  });
  // The small centered title and bar material appear once the large title scrolls under the bar.
  new IntersectionObserver(([e]) => $('#navbar').classList.toggle('scrolled', !e.isIntersecting), { rootMargin: '-44px 0px 0px 0px' }).observe($('#pagetitle'));
}

export function renderTabs() {
  const tab = pref.tab, t = TAB_INFO[tab];
  $('#app').dataset.tab = tab;
  $$('#tabbar button').forEach(b => b.dataset.tab === tab ? b.setAttribute('aria-current', 'page') : b.removeAttribute('aria-current'));
  $('#pagetitle').textContent = t.title; $('#navtitle').textContent = t.title;
  $$('[data-tabs]').forEach(el => { el.hidden = !el.dataset.tabs.split(' ').includes(tab); });
}
