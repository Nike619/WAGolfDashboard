// Map tab: courses colored by today's ground condition, over live NEXRAD radar.
// MapLibre (vector maps, OpenFreeMap tiles: free, no key) loads from cdnjs only when the tab is first opened.
// Tapping a course opens its sheet. The play button loops the last 50 minutes of radar.
import { $, esc, setPressed } from '../lib/dom.js';
import { todayPT } from '../lib/dates.js';
import { isPub, hasTimes } from '../model/courses.js';
import { lowestPrice } from '../model/teetimes.js';
import { state, pref, savePref } from '../state.js';
import { wet, times } from '../select.js';

const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/';
const SRI = { js: 'sha384-KKgyz2mG25bKJ1O2PyqTJPlAF8Kw2BpDmsLTNBXslICOBvhTAyF5F0XhLWF2ZovY', css: 'sha384-K282sW/zFjTkrjR/+yr1H+gCukuy4OEYrkXRybV88g7pk+kZZYpNV6SAV59NcgFg' };
const STYLE = { light: 'https://tiles.openfreemap.org/styles/positron', dark: 'https://tiles.openfreemap.org/styles/dark' };
// Iowa Environmental Mesonet's NEXRAD composite (base reflectivity), updated every 5 minutes; -mNNm is NN minutes earlier.
const RADAR = 'https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913{m}/{z}/{x}/{y}.png';
const RADAR_TIME = 'https://mesonet.agron.iastate.edu/data/gis/images/4326/USCOMP/n0q_0.json';
const RADAR_ATTR = 'Radar: NWS NEXRAD via <a href="https://mesonet.agron.iastate.edu/">IEM</a>';
const FRAMES = [50, 45, 40, 35, 30, 25, 20, 15, 10, 5, 0]; // minutes before the latest scan
const GROUND_VAR = { dry: '--accent', damp: '--muted', soft: '--sand', soggy: '--warn' };
const WA = [[-124.8, 45.5], [-116.9, 49.05]];
const dark = matchMedia('(prefers-color-scheme: dark)');

let ml, map, actions, popup, loading = null, failed = false, ready = false, shownView = null;
let radarAt = null, frame = FRAMES.length - 1, timer = null;

export function initMap(acts) {
  actions = acts;
  $('#radarplay').addEventListener('click', togglePlay);
  $('#mapshow').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; pref.mapshow = b.dataset.v; savePref(); drawCourses(); setPressed('#mapshow button', v => v === pref.mapshow); });
  dark.addEventListener('change', () => { if (map) { ready = false; map.setStyle(styleUrl(), { diff: false }); } });
  setInterval(() => { if (map && pref.tab === 'map') refreshRadar(); }, 5 * 60e3);
  addEventListener('online', () => { if (failed) { failed = false; loading = null; $('#map').innerHTML = ''; } });
}

export function renderMap() {
  if (pref.tab !== 'map') { stopPlay(); return; }
  setPressed('#mapshow button', v => v === pref.mapshow);
  if (failed) return;
  if (!map) { setup(); return; }
  map.resize(); // the tab was hidden, so the map's size may be stale
  drawCourses();
}

async function setup() {
  if (loading) return;
  try {
    loading = loadLibrary();
    ml = await loading;
    map = new ml.Map({ container: 'map', style: styleUrl(), bounds: WA, fitBoundsOptions: { padding: 20 }, attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false });
    map.touchZoomRotate.disableRotation();
    map.addControl(new ml.NavigationControl({ showCompass: false }), 'top-right');
    // OpenFreeMap's dark style names an icon it doesn't ship (circle-11); a blank stand-in avoids console warnings.
    map.on('styleimagemissing', e => { if (!map.hasImage(e.id)) map.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) }); });
    // Start the credits collapsed to their (i) button so they don't cover the radar control.
    map.once('load', () => map.getContainer().querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show'));
    // Overlays are lost whenever the style changes (light/dark), so they're added on every style load.
    map.on('style.load', () => { ready = true; addRadarSources(); addCourseLayers(); drawCourses(); showFrame(timer ? frame : FRAMES.length - 1); });
    // Dots are small, so a tap looks 14px around the finger and opens the nearest course (iOS asks for ~44pt targets).
    map.on('click', e => {
      const { x, y } = e.point, layers = ['courses-pub', 'courses-priv'].filter(id => map.getLayer(id));
      const hits = map.queryRenderedFeatures([[x - 14, y - 14], [x + 14, y + 14]], { layers });
      if (!hits.length) return;
      const d = f => { const p = map.project(f.geometry.coordinates); return (p.x - x) ** 2 + (p.y - y) ** 2; };
      actions.showCourse(hits.reduce((a, b) => d(b) < d(a) ? b : a).properties.id);
    });
    for (const id of ['courses-pub', 'courses-priv']) {
      map.on('mouseenter', id, e => { map.getCanvas().style.cursor = 'pointer'; showTip(e); });
      map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; popup?.remove(); });
    }
    await refreshRadar();
  } catch (e) {
    failed = true; loading = null;
    $('#map').innerHTML = '<p class="empty map-err">The map couldn\'t load. It will try again when you\'re back online.</p>';
  }
}

function loadLibrary() {
  if (window.maplibregl) return Promise.resolve(window.maplibregl);
  return new Promise((resolve, reject) => {
    const css = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: CDN + 'maplibre-gl.min.css', integrity: SRI.css, crossOrigin: 'anonymous', referrerPolicy: 'no-referrer' });
    const js = Object.assign(document.createElement('script'), { src: CDN + 'maplibre-gl.min.js', integrity: SRI.js, crossOrigin: 'anonymous', referrerPolicy: 'no-referrer' });
    js.onload = () => resolve(window.maplibregl);
    js.onerror = () => reject(new Error('MapLibre failed to load'));
    document.head.append(css, js);
  });
}

const styleUrl = () => dark.matches ? STYLE.dark : STYLE.light;
const cssVar = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
// Radar and courses go under the style's place names so towns stay readable.
const labelsLayer = () => map.getStyle().layers.find(l => l.type === 'symbol')?.id;

// ---------- courses ----------
function addCourseLayers() {
  map.addSource('courses', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
  const r = (lo, hi) => ['interpolate', ['linear'], ['zoom'], 5, lo, 11, hi];
  map.addLayer({ id: 'courses-priv', type: 'circle', source: 'courses', filter: ['!', ['get', 'pub']],
    paint: { 'circle-radius': r(4.5, 9), 'circle-color': cssVar('--surface'), 'circle-stroke-color': ['get', 'color'], 'circle-stroke-width': r(2, 3.5) } });
  map.addLayer({ id: 'courses-pub', type: 'circle', source: 'courses', filter: ['get', 'pub'],
    paint: { 'circle-radius': r(6, 11), 'circle-color': ['get', 'color'], 'circle-stroke-color': cssVar('--surface'), 'circle-stroke-width': r(1.5, 2.5) } });
}

function drawCourses() {
  if (!map || !ready || !map.getSource('courses')) return;
  const t0 = todayPT(), show = pref.mapshow;
  const list = state.courses.filter(c => c.active !== false && c.status === 'ready' && typeof c.lat === 'number' && typeof c.lon === 'number'
    && (!pref.region || c.region === pref.region) && (show === 'all' || (show === 'private') === !isPub(c)));
  map.getSource('courses').setData({ type: 'FeatureCollection', features: list.map(c => {
    const w = wet(c, t0), pub = isPub(c), t = pub && hasTimes(c) ? times(c.id, t0) : null;
    const open = t == null ? '' : t.length ? `${t.length} ${t.length === 1 ? 'time' : 'times'} left today${isFinite(lowestPrice(t)) ? ' from $' + lowestPrice(t) : ''}` : 'No times left today';
    return { type: 'Feature', geometry: { type: 'Point', coordinates: [c.lon, c.lat] },
      properties: { id: c.id, pub, color: cssVar(GROUND_VAR[w?.key] || '--empty'), name: c.name, ground: w ? w.label + ' today' : 'No rain data', open } };
  }) });
  const view = pref.region + '|' + show;
  if (shownView !== view && list.length) {
    const lons = list.map(c => c.lon), lats = list.map(c => c.lat);
    map.fitBounds([[Math.min(...lons), Math.min(...lats)], [Math.max(...lons), Math.max(...lats)]], { padding: 40, maxZoom: 10, duration: shownView == null ? 0 : 600 });
    shownView = view;
  }
}

function showTip(e) {
  const p = e.features[0].properties;
  popup?.remove();
  popup = new ml.Popup({ closeButton: false, offset: 12, className: 'course-tip' }).setLngLat(e.features[0].geometry.coordinates)
    .setHTML(`<b>${esc(p.name)}</b><br>${esc(p.ground)}${p.open ? '<br>' + esc(p.open) : ''}`).addTo(map);
}

// ---------- radar ----------
async function refreshRadar() {
  try {
    const j = await fetch(RADAR_TIME, { cache: 'no-store' }).then(r => r.json());
    const at = Date.parse(j.meta.valid);
    if (at === radarAt) return;
    radarAt = at;
  } catch (e) { if (radarAt != null) return; radarAt = Date.now(); }
  if (ready) { removeRadar(); addRadarSources(); showFrame(timer ? frame : FRAMES.length - 1); }
}

function addRadarSources() {
  if (radarAt == null) return;
  const before = labelsLayer();
  FRAMES.forEach((m, i) => {
    // ?v= changes with each scan so cached tiles from an older scan aren't reused.
    const url = RADAR.replace('{m}', m ? `-m${String(m).padStart(2, '0')}m` : '') + '?v=' + radarAt;
    map.addSource('radar' + i, { type: 'raster', tiles: [url], tileSize: 256, maxzoom: 10, attribution: RADAR_ATTR });
  });
  // Only the latest frame is drawn until play is pressed, so frames load on demand.
  addFrameLayer(FRAMES.length - 1, before);
}

function addFrameLayer(i, before = labelsLayer()) {
  if (map.getLayer('radar' + i)) return;
  map.addLayer({ id: 'radar' + i, type: 'raster', source: 'radar' + i, paint: { 'raster-opacity': 0, 'raster-fade-duration': 0 } }, before);
}

function removeRadar() {
  FRAMES.forEach((_, i) => { if (map.getLayer('radar' + i)) map.removeLayer('radar' + i); if (map.getSource('radar' + i)) map.removeSource('radar' + i); });
}

function showFrame(i) {
  frame = i;
  if (!ready || radarAt == null) return;
  addFrameLayer(i);
  FRAMES.forEach((_, k) => { if (map.getLayer('radar' + k)) map.setPaintProperty('radar' + k, 'raster-opacity', k === i ? 0.6 : 0); });
  const t = new Date(radarAt - FRAMES[i] * 60e3).toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric', minute: '2-digit' });
  $('#radartime').textContent = `Radar · ${t}`;
}

function togglePlay() {
  if (timer) { stopPlay(); return; }
  if (!ready) return;
  FRAMES.forEach((_, i) => addFrameLayer(i)); // start loading every frame
  $('#radarplay').setAttribute('aria-pressed', 'true');
  let i = 0, hold = 0;
  showFrame(0);
  timer = setInterval(() => {
    if (i === FRAMES.length - 1 && hold++ < 3) return; // pause on the latest scan
    hold = 0; i = (i + 1) % FRAMES.length; showFrame(i);
  }, 500);
}

function stopPlay() {
  if (!timer) return;
  clearInterval(timer); timer = null;
  $('#radarplay').setAttribute('aria-pressed', 'false');
  showFrame(FRAMES.length - 1);
}
