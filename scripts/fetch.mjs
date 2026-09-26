// Refreshes data/results.json (tee times), data/weather.json (rain) and data/meta.json.
// Runs daily from .github/workflows/update.yml. Node 20+, no dependencies.
// Read-only: it only looks up public tee-time availability; it never books anything.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const DAYS = 7;
const TZ = 'America/Los_Angeles';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36';

const readJSON = async (f, fallback) => { try { return JSON.parse(await fs.readFile(path.join(DATA, f), 'utf8')); } catch { return fallback; } };
const writeJSON = (f, v) => fs.writeFile(path.join(DATA, f), JSON.stringify(v) + '\n');
const sleep = ms => new Promise(r => setTimeout(r, ms));

export function datesFrom(now = new Date()) {
  const today = now.toLocaleDateString('en-CA', { timeZone: TZ });
  return [...Array(DAYS)].map((_, i) => { const d = new Date(today + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + i); return d.toISOString().slice(0, 10); });
}

async function getJSON(url, headers = {}, tries = 2) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json, text/plain, */*', ...headers }, signal: AbortSignal.timeout(20000) });
      const text = await r.text();
      if (!r.ok) throw new Error(`HTTP ${r.status}: ${text.slice(0, 120)}`);
      return JSON.parse(text);
    } catch (e) { last = e; await sleep(800 * (i + 1)); }
  }
  throw last;
}

// Each row: [ "HH:MM", pricePerPlayer|'' , spotsOpen|'' ]
const encode = rows => rows.map(([t, p, s]) => `${t.replace(':', '')},${p ?? ''},${s ?? ''}`).join(';');

// ---------- TeeItUp / GolfNow booking engine ----------
export function parseTeeItUp(json) {
  const tts = (Array.isArray(json) && json[0]?.teetimes) || [];
  return tts.map(t => {
    const open = t.maxPlayers - t.bookedPlayers;
    const rs = (t.rates || []).filter(x => x.holes === 18);
    if (!rs.length || open < 1) return null;
    const fees = rs.map(x => x.greenFeeWalking || x.greenFeeCart || 0).filter(Boolean);
    const time = new Date(t.teetime).toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit' });
    return [time, fees.length ? Math.round(Math.min(...fees) / 100) : '', open];
  }).filter(Boolean);
}
async function teeitup(c, date) {
  const a = c.params.alias;
  const json = await getJSON(`https://phx-api-be-east-1b.kenna.io/v2/tee-times?date=${date}&facilityIds=${c.params.facility}`,
    { 'x-be-alias': a, Origin: `https://${a}.book.teeitup.com`, Referer: `https://${a}.book.teeitup.com/` });
  return parseTeeItUp(json);
}

// ---------- Chronogolf (Lightspeed) ----------
// Availability depends on group size, so ask for 4, 3, 2, 1 and record the largest group that fits.
export function parseChrono(byPlayers) {
  const map = new Map();
  for (const n of [4, 3, 2, 1]) {
    for (const t of byPlayers[n] || []) {
      if (t.out_of_capacity || t.frozen || map.has(t.start_time)) continue;
      const g = t.green_fees?.[0];
      map.set(t.start_time, [t.start_time, g ? Math.round(g.subtotal ?? g.price) : '', n]);
    }
  }
  return [...map.values()].sort((a, b) => a[0].localeCompare(b[0]));
}
async function chronogolf(c, date) {
  const { club, course, aff } = c.params, by = {};
  for (const n of [4, 3, 2, 1]) {
    const q = `https://www.chronogolf.com/marketplace/clubs/${club}/teetimes?date=${date}&course_id=${course}&nb_holes=18&` + Array(n).fill('affiliation_type_ids%5B%5D=' + aff).join('&');
    const r = await getJSON(q, { Referer: `https://www.chronogolf.com/club/${club}/widget` });
    by[n] = Array.isArray(r) ? r : [];
  }
  return parseChrono(by);
}

// ---------- foreUP ----------
const foreupCookies = new Map();
async function foreupSession(c) {
  const key = c.params.courseId;
  if (foreupCookies.has(key)) return foreupCookies.get(key);
  const r = await fetch(`https://foreupsoftware.com/index.php/booking/${c.params.courseId}/${c.params.scheduleId}`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20000) });
  const cookie = (r.headers.getSetCookie?.() || []).map(x => x.split(';')[0]).join('; ');
  foreupCookies.set(key, cookie);
  return cookie;
}
export function parseForeup(json) {
  return (Array.isArray(json) ? json : []).filter(t => t.available_spots >= 1)
    .map(t => [t.time.slice(11, 16), t.green_fee_18 || t.green_fee || '', t.available_spots]);
}
async function foreup(c, date) {
  const [y, m, d] = date.split('-');
  const cookie = await foreupSession(c);
  const s = c.params.scheduleId;
  const json = await getJSON(`https://foreupsoftware.com/index.php/api/booking/times?time=all&date=${m}-${d}-${y}&holes=18&players=1&booking_class=${c.params.bookingClass}&schedule_id=${s}&schedule_ids%5B%5D=${s}&specials_only=0&api_key=no_limits`,
    { 'Api-Key': 'no_limits', 'X-Requested-With': 'XMLHttpRequest', Referer: `https://foreupsoftware.com/index.php/booking/${c.params.courseId}/${s}`, ...(cookie ? { Cookie: cookie } : {}) });
  return parseForeup(json);
}

const PLATFORMS = { teeitup, chronogolf, foreup };

async function pool(items, n, fn) {
  const out = []; let i = 0;
  await Promise.all([...Array(n)].map(async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k]); } }));
  return out;
}

async function fetchCourse(c, dates) {
  const days = {};
  for (const d of dates) { days[d] = encode(await PLATFORMS[c.platform](c, d)); await sleep(250); }
  return days;
}

async function fetchWeather(courses) {
  const out = {};
  const pts = courses.filter(c => typeof c.lat === 'number' && typeof c.lon === 'number');
  for (let i = 0; i < pts.length; i += 40) {
    const W = pts.slice(i, i + 40);
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${W.map(x => x.lat).join(',')}&longitude=${W.map(x => x.lon).join(',')}&daily=precipitation_sum,precipitation_probability_max&past_days=3&forecast_days=7&timezone=America%2FLos_Angeles&precipitation_unit=inch`;
    let r = await getJSON(u, {}, 3); if (!Array.isArray(r)) r = [r];
    W.forEach((c, j) => { const d = r[j].daily, days = {}; d.time.forEach((t, k) => days[t] = [Math.round((d.precipitation_sum[k] || 0) * 100) / 100, d.precipitation_probability_max[k] ?? null]); out[c.id] = { updatedAt: new Date().toISOString(), days }; });
  }
  return out;
}

async function main() {
  const started = new Date().toISOString();
  const courses = (await readJSON('courses.json', [])).filter(c => c.active !== false);
  const prevResults = await readJSON('results.json', {});
  const prevWeather = await readJSON('weather.json', {});
  const dates = datesFrom();
  const bookable = courses.filter(c => c.access !== 'private' && PLATFORMS[c.platform] && c.params);
  const results = {}, failures = [];

  await pool(bookable, 4, async c => {
    try {
      const days = await fetchCourse(c, dates);
      results[c.id] = { ok: true, checkedAt: new Date().toISOString(), days };
      console.log(`ok   ${c.id}: ${Object.values(days).reduce((n, v) => n + (v ? v.split(';').length : 0), 0)} times`);
    } catch (e) {
      failures.push(c.name);
      const prev = prevResults[c.id] || {};
      results[c.id] = { ...prev, ok: false, error: String(e.message || e).slice(0, 160) };
      console.log(`FAIL ${c.id}: ${e.message || e}`);
    }
  });

  let weather = prevWeather, weatherError = '';
  try { weather = await fetchWeather(courses); console.log(`ok   weather for ${Object.keys(weather).length} courses`); }
  catch (e) { weatherError = 'Rain data could not be refreshed'; console.log('FAIL weather:', e.message || e); }

  const okCount = bookable.length - failures.length;
  const meta = {
    status: bookable.length && !okCount ? 'error' : 'done', startedAt: started, finishedAt: new Date().toISOString(),
    courses: courses.length, checked: bookable.length, failed: failures.length,
    message: [failures.length ? `Couldn't read ${failures.length}: ${failures.slice(0, 6).join(', ')}${failures.length > 6 ? '…' : ''}` : '', weatherError].filter(Boolean).join(' · '),
  };
  await writeJSON('results.json', results);
  await writeJSON('weather.json', weather);
  await writeJSON('meta.json', meta);
  console.log(JSON.stringify(meta));
  if (meta.status === 'error') process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch(e => { console.error(e); process.exit(1); });
