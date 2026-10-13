// Loading screen (shown by the inline script in index.html on the first open of a session): a ball rolls
// to the cup while data loads, then the golf outlook for today, or for tomorrow from 3:30 PM, for public
// courses in the chosen region. Tap "Let's play" or anywhere to continue; it also closes on its own.
import { $, esc } from '../lib/dom.js';
import { todayPT, shift } from '../lib/dates.js';
import { outlook } from '../model/outlook.js';
import { isPub } from '../model/courses.js';
import { state, pref } from '../state.js';
import { SPLASH_PHOTOS } from '../config.js';
import { wet, rainOn, rainPct, low, frost, high, code } from '../select.js';

const MIN_MS = 1400, AUTO_MS = 8000, STEP_MS = 350; // each piece of the outlook appears STEP_MS after the last
const started = performance.now();
const ICONS = {
  sun: '<circle cx="12" cy="12" r="4.2" stroke="var(--sand)"/><path stroke="var(--sand)" d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/>',
  partly: '<circle cx="8.5" cy="8.5" r="3.2" stroke="var(--sand)"/><path stroke="var(--sand)" d="M8.5 2v1.6M2 8.5h1.6M3.9 3.9l1.1 1.1M13.1 3.9l-1.1 1.1"/><path stroke="var(--muted)" d="M8 19.5h9.5a3.5 3.5 0 0 0 .4-7 5 5 0 0 0-9.6 1.4A2.9 2.9 0 0 0 8 19.5z"/>',
  cloud: '<path stroke="var(--muted)" d="M6.5 18.5h11a4 4 0 0 0 .5-8 6 6 0 0 0-11.5 1.6A3.3 3.3 0 0 0 6.5 18.5z"/>',
  fog: '<path stroke="var(--muted)" d="M4 9h16M6 13h12M4 17h16"/>',
  rain: '<path stroke="var(--muted)" d="M6.5 14.5h11a4 4 0 0 0 .5-8 6 6 0 0 0-11.5 1.6A3.3 3.3 0 0 0 6.5 14.5z"/><path stroke="var(--rain)" d="M8 17.5l-1 2.5M12 17.5l-1 2.5M16 17.5l-1 2.5"/>',
  snow: '<path stroke="var(--muted)" d="M6.5 14.5h11a4 4 0 0 0 .5-8 6 6 0 0 0-11.5 1.6A3.3 3.3 0 0 0 6.5 14.5z"/><path stroke="var(--snow)" d="M8 18.5h.01M12 19.5h.01M16 18.5h.01M10 21.5h.01M14 21.5h.01" stroke-width="2.4"/>',
  storm: '<path stroke="var(--muted)" d="M6.5 14.5h11a4 4 0 0 0 .5-8 6 6 0 0 0-11.5 1.6A3.3 3.3 0 0 0 6.5 14.5z"/><path stroke="var(--sand)" d="M12.5 15l-2 3.5h3l-2 3.5"/>',
};

let auto = null;
const el = () => $('#splash');
export const splashOn = () => !el().hidden && !el().classList.contains('leaving');

export function initSplash() {
  if (!splashOn()) return;
  // A random background photo, faded in once it has loaded so a slow photo never holds up the screen.
  if (SPLASH_PHOTOS.length) {
    const src = 'images/splash/' + SPLASH_PHOTOS[Math.floor(Math.random() * SPLASH_PHOTOS.length)], img = new Image();
    // A full URL: a relative url() inside a CSS variable resolves against the stylesheet that uses it (styles/).
    img.onload = () => { el().style.setProperty('--photo', `url("${new URL(src, location.href).href}")`); el().classList.add('photo'); };
    img.src = src;
  }
  $('#splashgo').addEventListener('click', dismiss);
  el().addEventListener('click', e => { if (el().classList.contains('ready') && !e.target.closest('.splash-card')) dismiss(); });
  $('#splashcard').addEventListener('click', () => { clearTimeout(auto); auto = null; }); // reading it: don't close on its own
}

// Data loaded: show the outlook (after the animation has had a moment), or just close if there's nothing to say.
export function splashReady() {
  if (!splashOn()) return;
  const ahead = el().dataset.day === 'tomorrow', day = ahead ? shift(todayPT(), 1) : todayPT();
  const courses = state.courses.filter(c => isPub(c) && c.active !== false && c.status === 'ready' && (!pref.region || c.region === pref.region));
  const o = outlook(courses.map(c => ({ ground: wet(c, day)?.key || null, rain: rainOn(c, day), chance: rainPct(c, day), low: low(c, day), high: high(c, day), code: code(c, day), frost: frost(c, day) })), { ahead });
  if (!o) { dismiss(); return; }
  clearTimeout(window.__splashFailsafe); // the app is running; the inline safety timer isn't needed
  setTimeout(() => {
    // Each piece gets --i, its place in the sequence; CSS delays its fade-in by --i × the step.
    let i = 0; const n = () => `style="--i:${i++}"`;
    $('#splashcard').innerHTML = `<div class="skyicon step" ${n()}><svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[o.sky] || ICONS.partly}</svg></div>
      <span class="when step" ${n()}>${ahead ? 'Tomorrow' : 'Today'}</span><h2 class="step" ${n()}>${esc(o.headline)}</h2><span class="verdict ${o.tone} step" ${n()}>${esc(o.verdict)}</span>
      <ul>${o.lines.map(l => `<li class="step" ${n()}>${esc(l)}</li>`).join('')}</ul>
      <span class="where step" ${n()}>${esc(pref.region || 'All of Washington')} · ${courses.length} public courses</span>`;
    $('#splashgo').style.setProperty('--i', i++);
    el().style.setProperty('--step', STEP_MS + 'ms');
    $('#splashcard').hidden = false; $('#splashgo').hidden = false; el().classList.add('ready');
    // The auto-close timer starts once everything is showing.
    const shown = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : i * STEP_MS;
    auto = setTimeout(dismiss, shown + AUTO_MS);
  }, Math.max(0, MIN_MS - (performance.now() - started)));
}

export function dismiss() {
  clearTimeout(window.__splashFailsafe);
  if (!splashOn()) return;
  clearTimeout(auto);
  el().classList.add('leaving');
  document.documentElement.classList.remove('splashing');
  setTimeout(() => { el().hidden = true; }, 350);
}
