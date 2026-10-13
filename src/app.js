// Entry point: loads data/*.json, wires up the views, and re-renders on every change.
import { $, setPressed } from './lib/dom.js';
import { initSheet } from './lib/sheets.js';
import { state, pref, readHash, writeHash, savePref } from './state.js';
import { dates as dateRange, inView, sorted, cheapestByDay, times } from './select.js';
import { isPub, hasTimes } from './model/courses.js';
import { withSoil } from './model/soil.js';
import { renderStatus, showLoadError } from './views/status.js';
import { initTabs, renderTabs } from './views/tabs.js';
import { initFilters, renderFilters } from './views/filters.js';
import { initDayPicker, renderDayPicker } from './views/dayPicker.js';
import { initDayList, renderDayList } from './views/dayList.js';
import { initTeeSheet, renderTeeSheet } from './views/teeSheet.js';
import { renderBookDirect } from './views/bookDirect.js';
import { renderPrivateClubs } from './views/privateClubs.js';
import { renderTimeDetail } from './views/timeDetail.js';
import { renderCourseDetail } from './views/courseDetail.js';
import { renderManage } from './views/manage.js';
import { initMap, renderMap } from './views/map.js';
import { initSplash, splashReady, dismiss as dismissSplash } from './views/splash.js';

function render() {
  pref.access = pref.tab === 'private' ? 'private' : 'public';
  const priv = pref.access === 'private';
  if (pref.tab !== 'times' && (pref.sort === 'price' || pref.sort === 'early')) pref.sort = 'rank';
  const dates = dateRange();
  if (state.day && !dates.includes(state.day)) state.day = null; // a shared link's day has passed
  renderTabs();
  renderFilters();
  renderStatus();
  const view = state.courses.filter(inView);
  const sheetCs = sorted(view.filter(c => isPub(c) && hasTimes(c)));
  // Unless a day was picked, show the first day with open times (in the evening, today is usually done).
  const hasOpen = d => sheetCs.some(c => (times(c.id, d) || []).length);
  const day = state.day || dates.find(hasOpen) || dates[0];
  const ctx = { priv, dates, day, view, sheetCs, minBy: cheapestByDay(sheetCs, dates) };
  renderDayPicker(ctx);
  if (!priv) {
    const week = pref.view === 'week';
    setPressed('#viewseg button', v => v === pref.view);
    $('#dayview').hidden = week; $('#weekview').hidden = !week;
    if (week) { $('#dayh').textContent = 'This week'; $('#daynote').textContent = `Open times for ${pref.players} · tap a day for its list`; renderTeeSheet(ctx); }
    else renderDayList(ctx);
    renderBookDirect(ctx);
  } else renderPrivateClubs(ctx);
  renderTimeDetail(priv);
  renderCourseDetail();
  renderManage();
  renderMap();
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
initDayPicker(render, actions);
initDayList(render, actions);
$('#viewseg').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; pref.view = b.dataset.v; savePref(); render(); });
initTeeSheet(render, actions);
initMap(actions);
initSplash();
window.addEventListener('hashchange', () => { readHash(); state.sel = null; render(); });
writeHash();

async function load() {
  const bust = '?t=' + Math.floor(Date.now() / 60000);
  const get = f => fetch('data/' + f + bust).then(r => { if (!r.ok) throw new Error(f + ' ' + r.status); return r.json(); });
  try {
    // soils.json comes from a separate, occasional workflow; the page works without it.
    const [c, r, w, m, s] = await Promise.all([get('courses.json'), get('results.json'), get('weather.json'), get('meta.json'), get('soils.json').catch(() => ({}))]);
    state.courses = c.map(x => withSoil({ status: 'ready', ...x }, s.courses?.[x.id])); state.results = r; state.weather = w; state.run = m; state.soilsAt = s.generatedAt || null; state.loaded = true; render(); splashReady();
  } catch (e) { showLoadError(); dismissSplash(); }
}
render();
load();
setInterval(render, 60000);
setInterval(load, 15 * 60000);
addEventListener('online', load);
addEventListener('offline', render);

// Installable app + offline copy (see sw.js). Service workers need https or localhost.
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {});
