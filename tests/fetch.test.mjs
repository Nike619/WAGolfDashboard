// Offline test for scripts/fetch.mjs. No network: fetch is mocked with response shapes
// captured from the real booking sites, and the run uses a small set of sample courses
// (not data/courses.json), so editing the course list never breaks this test.
// Run: node tests/fetch.test.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// realpath: on macOS the temp dir is a symlink, and fetch.mjs compares argv[1] with its resolved import.meta.url.
const tmp = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'teesheet-')));
await fs.cp(path.join(REPO, 'scripts'), path.join(tmp, 'scripts'), { recursive: true });
await fs.mkdir(path.join(tmp, 'data'));

// One course per platform, 9 TeeItUp courses to exercise the per-run cap, one private club,
// a sold-out Chronogolf course and a foreUP course that needs a login (HTTP 401).
const course = (id, platform, params) => ({ id, name: id, access: 'public', active: true, status: 'ready', lat: 47.2, lon: -122.4, platform, params });
const courses = [
  course('cg', 'chronogolf', { club: 1, course: 2, aff: 3 }),
  course('cg-full', 'chronogolf', { club: 5, course: 6, aff: 7 }),
  course('fu', 'foreup', { courseId: 10, scheduleId: 11, bookingClass: 12 }),
  course('fu-login', 'foreup', { courseId: 20, scheduleId: 21, bookingClass: 22 }),
  course('ts', 'teesnap', { host: 'golfsample', course: 789 }),
  course('cp', 'clubprophet', { host: 'samplecourse', courseIds: '2' }),
  ...Array.from({ length: 9 }, (_, i) => course('ti' + i, 'teeitup', { alias: 'sample-' + i, facility: 100 + i })),
  { id: 'priv', name: 'Sample Country Club', access: 'private', active: true, status: 'ready', lat: 47.6, lon: -122.3, platform: null },
  { ...course('paused', 'teeitup', { alias: 'paused', facility: 999 }), active: false },
];
await fs.writeFile(path.join(tmp, 'data/courses.json'), JSON.stringify(courses));
// ti8 was checked recently, so the stalest-first cap should defer it and keep its old data.
await fs.writeFile(path.join(tmp, 'data/results.json'), JSON.stringify({
  ti8: { ok: true, checkedAt: new Date().toISOString(), dataAt: new Date().toISOString(), days: { '2026-01-01': '0800,50,4' } },
}));

// Make the script's pacing/backoff sleeps instant.
const realTimeout = globalThis.setTimeout;
globalThis.setTimeout = (f, ms, ...a) => realTimeout(f, Math.min(ms || 0, 1), ...a);

const seen = new Set(), calls = [];
globalThis.fetch = async (url, opts = {}) => {
  url = String(url); calls.push(url);
  const J = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json' } });
  if (url.includes('kenna.io')) {
    seen.add('teeitup');
    assert(opts.headers['x-be-alias'], 'TeeItUp calls need the x-be-alias header');
    assert(!opts.headers['x-be-alias'].startsWith('paused'), 'paused courses are skipped');
    return J([{ teetimes: [
      { teetime: '2026-09-28T14:20:00.000Z', maxPlayers: 4, bookedPlayers: 0, rates: [{ holes: 18, greenFeeWalking: 7000 }, { holes: 9, greenFeeWalking: 3000 }] },
      { teetime: '2026-09-28T20:00:00.000Z', maxPlayers: 4, bookedPlayers: 3, rates: [{ holes: 18, greenFeeCart: 8900 }] },
      { teetime: '2026-09-28T21:00:00.000Z', maxPlayers: 4, bookedPlayers: 4, rates: [{ holes: 18, greenFeeWalking: 6000 }] },
      { teetime: '2026-09-28T22:00:00.000Z', maxPlayers: 4, bookedPlayers: 0, rates: [{ holes: 9, greenFeeWalking: 2000 }] } ] }]);
  }
  if (url.includes('chronogolf.com/marketplace/clubs/5/')) return J([]);
  if (url.includes('chronogolf.com/marketplace')) {
    seen.add('chronogolf');
    const n = (url.match(/affiliation_type_ids/g) || []).length; // group size asked for
    const mk = (st, full) => ({ start_time: st, out_of_capacity: full, frozen: false, green_fees: [{ price: 146.05, subtotal: 166.05 }] });
    return J([mk('07:03', n > 2), mk('11:42', false), mk('16:00', n > 1)]);
  }
  if (url.includes('foreupsoftware.com/index.php/booking/')) {
    return new Response('<html></html>', { status: 200, headers: { 'set-cookie': 'PHPSESSID=abc; path=/' } });
  }
  if (url.includes('foreupsoftware.com/index.php/api/booking/times')) {
    seen.add('foreup');
    assert.equal(opts.headers.Cookie, 'PHPSESSID=abc', 'foreUP calls reuse the session cookie');
    if (url.includes('schedule_id=21')) return J({ success: false, msg: 'logged out' }, 401);
    return J([{ time: '2026-09-28 15:33', available_spots: 4, green_fee_18: 62 }, { time: '2026-09-28 16:00', available_spots: 0, green_fee_18: 53 }]);
  }
  if (url.includes('api.teesnap.net')) {
    seen.add('teesnap');
    return J({ teeTimes: {
      bookings: [{ bookingId: 'b1', golfers: [1, 2] }],
      teeTimes: [
        { teeTime: '2026-09-28T09:10:00', prices: [{ roundType: 'EIGHTEEN_HOLE', price: '54.00' }], teeOffSections: [{ teeOff: 'FRONT_NINE', bookings: ['b1'], isHeld: false }] },
        { teeTime: '2026-09-28T09:20:00', prices: [{ roundType: 'EIGHTEEN_HOLE', price: '54.00' }], teeOffSections: [{ teeOff: 'FRONT_NINE', bookings: [], isHeld: true }] },
      ] } });
  }
  if (url.includes('.cps.golf/identityapi')) return J({ access_token: 'guest' });
  if (url.includes('.cps.golf') && url.includes('RegisterTransactionId')) return J(true);
  if (url.includes('.cps.golf') && url.includes('TeeTimes')) {
    seen.add('clubprophet');
    assert.equal(opts.headers.Authorization, 'Bearer guest', 'Club Prophet calls use the guest token');
    return J({ content: [
      { startTime: '2026-09-28T10:04:00', availableSlot: 3, shItemPrices: [{ shItemCode: 'GreenFee18', displayPrice: 48.5 }, { shItemCode: 'GreenFee9', displayPrice: 30 }] },
      { startTime: '2026-09-28T10:13:00', availableSlot: 0, shItemPrices: [{ shItemCode: 'GreenFee18', displayPrice: 48.5 }] },
    ] });
  }
  if (url.includes('open-meteo')) {
    const n = new URL(url).searchParams.get('latitude').split(',').length;
    const hours = d => [...Array(24)].map((_, h) => `${d}T${String(h).padStart(2, '0')}:00`);
    const cold = [30, 29, 29, 28, 28, 28, 29, 31, 33, 35, 37, 40, ...Array(12).fill(45)]; // 28°F low, 37°F at 10:00
    const one = { daily: { time: ['2026-09-25', '2026-09-26'], precipitation_sum: [0.123, 0], precipitation_probability_max: [90, 5], et0_fao_evapotranspiration: [0.031, 0.12], temperature_2m_min: [27.6, 50.2] },
      hourly: { time: [...hours('2026-09-25'), ...hours('2026-09-26')], temperature_2m: [...cold, ...Array(24).fill(55)], snow_depth: [...Array(24).fill(0.25), ...Array(24).fill(0)] } };
    return J(n === 1 ? one : Array(n).fill(one));
  }
  throw new Error('Unexpected request: ' + url);
};

const script = path.join(tmp, 'scripts/fetch.mjs');
const mod = await import(script);

// Parser checks
assert.deepEqual(mod.parseTeeItUp([{ teetimes: [{ teetime: '2026-09-28T14:20:00.000Z', maxPlayers: 4, bookedPlayers: 1, rates: [{ holes: 18, greenFeeWalking: 7000 }] }] }]), [['07:20', 70, 3]]);
assert.deepEqual(mod.parseChrono({ 4: [{ start_time: '08:00', out_of_capacity: true }], 2: [{ start_time: '08:00', out_of_capacity: false, green_fees: [{ subtotal: 60 }] }] }), [['08:00', 60, 2]]);
assert.deepEqual(mod.parseForeup([{ time: '2026-09-28 15:33', available_spots: 4, green_fee_18: 62 }, { time: '2026-09-28 16:00', available_spots: 0 }]), [['15:33', 62, 4]]);
assert.deepEqual(mod.parseClubProphet({ isSuccess: true, content: { messageKey: 'NO_TEETIMES', messageTemplate: 'No tee times available' } }), [], 'Club Prophet day with no times');
assert.equal(mod.datesFrom(new Date('2026-09-27T05:00:00Z'))[0], '2026-09-26', 'dates use Pacific time');

// Full run (main() only runs when argv[1] is the script)
process.argv[1] = script;
await import(script + '?run');
let meta;
for (let i = 0; i < 3000 && !meta?.finishedAt; i++) {
  try { meta = JSON.parse(await fs.readFile(path.join(tmp, 'data/meta.json'), 'utf8')); } catch {}
  await new Promise(r => realTimeout(r, 20));
}
assert(meta?.finishedAt, 'run never finished (did main() start?)');
const results = JSON.parse(await fs.readFile(path.join(tmp, 'data/results.json'), 'utf8'));
const weather = JSON.parse(await fs.readFile(path.join(tmp, 'data/weather.json'), 'utf8'));
const d0 = mod.datesFrom()[0];
const count = s => calls.filter(u => u.includes(s)).length;

assert.deepEqual([...seen].sort(), ['chronogolf', 'clubprophet', 'foreup', 'teeitup', 'teesnap'], 'every platform was called');
assert.equal(meta.status, 'partial');
assert.equal(meta.failed, 1, 'only the login-only foreUP course fails');
assert.equal(meta.bookable, 15);
assert.equal(meta.deferred, 2, 'TeeItUp capped at 7 of its 9 courses');
assert.equal(results.ti8.days['2026-01-01'], '0800,50,4', 'the most recently checked TeeItUp course is deferred and keeps its data');
assert.equal(Object.keys(weather).length, courses.filter(c => c.active !== false).length, 'rain data for every active course, private included');
assert.equal(results.ti0.days[d0], '0720,70,4;1300,89,1', 'TeeItUp: 18-hole rates only, full times dropped');
assert.equal(results.cg.days[d0], '0703,166,2;1142,166,4;1600,166,1', 'Chronogolf records the largest group that fits');
assert.equal(count('/clubs/1/teetimes'), 7 * 4, 'Chronogolf asks 1, 4, 3, 2 players while group sizes are unknown');
assert.equal(results['cg-full'].days[d0], '', 'sold-out Chronogolf day is empty');
assert.equal(count('/clubs/5/teetimes'), 7, 'Chronogolf stops after 1 player when nothing is open');
assert.ok(results['cg-full'].warning, 'a course with no times all week gets a warning');
assert.equal(results.fu.days[d0], '1533,62,4', 'foreUP drops full times');
assert.equal(results['fu-login'].ok, false, 'login-only foreUP course fails');
assert.match(results['fu-login'].error, /HTTP 401/);
assert.equal(count('schedule_id=21'), 1, 'a 401 is not retried');
assert.equal(results.ts.days[d0], '0910,54,2', 'TeeSnap: open spots = 4 minus booked golfers; held times dropped');
assert.equal(results.cp.days[d0], '1004,49,3', 'Club Prophet: 18-hole price, full times dropped');
assert.equal(count('identityapi'), 1, 'Club Prophet guest token is reused for the whole run');
assert(!results.priv && !results.paused, 'private and paused courses get no tee times');
assert.deepEqual(Object.values(weather)[0].days['2026-09-25'], [0.12, 90, 0.03, 28, '11:00', 3], 'weather day: rain, chance, evaporation, low, frost until, snow depth (in)');
assert.deepEqual(Object.values(weather)[0].days['2026-09-26'], [0, 5, 0.12, 50, null, 0], 'warm day: no frost, no snow');
assert.equal(mod.frostUntil([...Array(24).fill(30)]), '24:00', 'never thaws: frost all day');
assert.equal(mod.frostUntil([...Array(24).fill(40)]), null, 'mild night: no frost');
assert.equal(mod.frostUntil([1, 2]), null, 'missing hours: no estimate');
console.log(`All tests passed (${Object.keys(results).length} courses with results, ${Object.keys(weather).length} with rain, ${calls.length} requests).`);
await fs.rm(tmp, { recursive: true, force: true });
