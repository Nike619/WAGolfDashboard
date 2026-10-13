// Entry point: loads data/*.json, wires up the views, and re-renders on every change.
import { $ } from './lib/dom.js';
import { initSheet } from './lib/sheets.js';
import { state, pref, readHash, writeHash } from './state.js';
import { dates as dateRange, inView, sorted, cheapestByDay } from './select.js';
import { isPub, hasTimes } from './model/courses.js';
import { renderStatus, showLoadError } from './views/status.js';
import { initTabs, renderTabs } from './views/tabs.js';
import { initFilters, renderFilters } from './views/filters.js';
import { initBest, renderBest } from './views/best.js';
import { initTeeSheet, renderTeeSheet } from './views/teeSheet.js';
import { renderBookDirect } from './views/bookDirect.js';
import { renderPrivateClubs } from './views/privateClubs.js';
import { renderTimeDetail } from './views/timeDetail.js';
import { renderCourseDetail } from './views/courseDetail.js';
import { renderManage } from './views/manage.js';

function render() {
  pref.access = pref.tab === 'private' ? 'private' : 'public';
  const priv = pref.access === 'private';
  if (pref.tab !== 'times' && pref.sort === 'price') pref.sort = 'rank';
  renderTabs();
  renderFilters();
  renderStatus();
  const dates = dateRange(), view = state.courses.filter(inView);
  const sheetCs = sorted(view.filter(c => isPub(c) && hasTimes(c)));
  const ctx = { priv, dates, view, sheetCs, minBy: cheapestByDay(sheetCs, dates) };
  renderBest(ctx);
  if (!priv) { renderTeeSheet(ctx); renderBookDirect(ctx); }
  else renderPrivateClubs(ctx);
  renderTimeDetail(priv);
  renderCourseDetail();
  renderManage();
}

const actions = {
  showCourse(id) { state.csel = id; render(); },
  showTimes(c, d) { state.sel = { c, d }; render(); },
};

// Any element with data-cd (a course name, a list row) opens that course's sheet.
document.addEventListener('click', e => {
  const b = e.target.closest('[data-cd]');
  if (b) actions.showCourse(b.dataset.cd);
});
// Closing a sheet any way (Done, Esc, backdrop, drag) clears what it was showing.
initSheet($('#detail'), () => { if (state.sel) { state.sel = null; render(); } });
initSheet($('#cdetail'), () => { if (state.csel) { state.csel = null; render(); } });
initTabs(render);
initFilters(render);
initBest(render, actions);
initTeeSheet(render, actions);
window.addEventListener('hashchange', () => { readHash(); state.sel = null; render(); });
writeHash();

// GitHub links derived from the Pages URL (user.github.io/repo)
(function () {
  const h = location.hostname, m = h.match(/^([^.]+)\.github\.io$/i); if (!m) return;
  const repo = location.pathname.split('/').filter(Boolean)[0] || (m[1] + '.github.io'); const base = `https://github.com/${m[1]}/${repo}`;
  $('#refresh').href = base + '/actions/workflows/update.yml'; const el = $('#editlink'); if (el) el.href = base + '/edit/main/data/courses.json';
})();

async function load() {
  const bust = '?t=' + Math.floor(Date.now() / 60000);
  const get = f => fetch('data/' + f + bust).then(r => { if (!r.ok) throw new Error(f + ' ' + r.status); return r.json(); });
  try {
    const [c, r, w, m] = await Promise.all([get('courses.json'), get('results.json'), get('weather.json'), get('meta.json')]);
    state.courses = c.map(x => ({ status: 'ready', ...x })); state.results = r; state.weather = w; state.run = m; state.loaded = true; render();
  } catch (e) { showLoadError(); }
}
render();
load();
setInterval(render, 60000);
setInterval(load, 15 * 60000);
