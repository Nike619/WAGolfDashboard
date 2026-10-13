// Offline test for scripts/fetch.mjs. No network: fetch is mocked with response shapes
// captured from the real booking sites. Run: node tests/fetch.test.mjs
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'teesheet-'));
await fs.cp(path.join(REPO, 'scripts'), path.join(tmp, 'scripts'), { recursive: true });
await fs.mkdir(path.join(tmp, 'data'));
await fs.copyFile(path.join(REPO, 'data/courses.json'), path.join(tmp, 'data/courses.json'));

// Make the script's pacing/backoff sleeps instant.
const realTimeout = globalThis.setTimeout;
globalThis.setTimeout = (f, ms, ...a) => realTimeout(f, Math.min(ms || 0, 1), ...a);

globalThis.fetch = async (url, opts = {}) => {
  url = String(url);
  const J = o => new Response(JSON.stringify(o), { status: 200, headers: { 'content-type': 'application/json' } });
  if (url.includes('kenna.io')) {
    assert(opts.headers['x-be-alias'], 'TeeItUp calls need the x-be-alias header');
    return J([{ teetimes: [
      { teetime: '2026-09-28T14:20:00.000Z', maxPlayers: 4, bookedPlayers: 0, rates: [{ holes: 18, greenFeeWalking: 7000 }, { holes: 9, greenFeeWalking: 3000 }] },
      { teetime: '2026-09-28T20:00:00.000Z', maxPlayers: 4, bookedPlayers: 3, rates: [{ holes: 18, greenFeeCart: 8900 }] },
      { teetime: '2026-09-28T21:00:00.000Z', maxPlayers: 4, bookedPlayers: 4, rates: [{ holes: 18, greenFeeWalking: 6000 }] },
      { teetime: '2026-09-28T22:00:00.000Z', maxPlayers: 4, bookedPlayers: 0, rates: [{ holes: 9, greenFeeWalking: 2000 }] } ] }]);
  }
  if (url.includes('chronogolf.com/marketplace')) {
    const n = (url.match(/affiliation_type_ids/g) || []).length; // group size asked for
    const mk = (st, full) => ({ start_time: st, out_of_capacity: full, frozen: false, green_fees: [{ price: 146.05, subtotal: 166.05 }] });
    return J([mk('07:03', n > 2), mk('11:42', false), mk('16:00', n > 1)]);
  }
  if (url.includes('foreupsoftware.com/index.php/booking/')) {
    return new Response('<html></html>', { status: 200, headers: { 'set-cookie': 'PHPSESSID=abc; path=/' } });
  }
  if (url.includes('foreupsoftware.com/index.php/api/booking/times')) {
    assert.equal(opts.headers.Cookie, 'PHPSESSID=abc', 'foreUP calls reuse the session cookie');
    return J([{ time: '2026-09-28 15:33', available_spots: 4, green_fee_18: 62 }, { time: '2026-09-28 16:00', available_spots: 0, green_fee_18: 53 }]);
  }
  if (url.includes('open-meteo')) {
    const n = new URL(url).searchParams.get('latitude').split(',').length;
    const one = { daily: { time: ['2026-09-25', '2026-09-26'], precipitation_sum: [0.123, 0], precipitation_probability_max: [90, 5] } };
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
assert.equal(mod.datesFrom(new Date('2026-09-27T05:00:00Z'))[0], '2026-09-26', 'dates use Pacific time');

// Full run (main() only runs when argv[1] is the script)
process.argv[1] = script;
await import(script + '?run');
let meta;
for (let i = 0; i < 2000 && !meta?.finishedAt; i++) {
  try { meta = JSON.parse(await fs.readFile(path.join(tmp, 'data/meta.json'), 'utf8')); } catch {}
  await new Promise(r => realTimeout(r, 20));
}
const courses = JSON.parse(await fs.readFile(path.join(tmp, 'data/courses.json'), 'utf8'));
const results = JSON.parse(await fs.readFile(path.join(tmp, 'data/results.json'), 'utf8'));
const weather = JSON.parse(await fs.readFile(path.join(tmp, 'data/weather.json'), 'utf8'));
const d0 = mod.datesFrom()[0];

assert.equal(meta.failed, 0, 'no fetch failures');
assert.equal(Object.keys(weather).length, courses.filter(c => c.active !== false).length, 'rain data for every course');
const teeitup = courses.filter(c => c.platform === 'teeitup' && c.access !== 'private' && c.active !== false);
assert.equal(teeitup.filter(c => results[c.id]?.ok).length, Math.min(7, teeitup.length), 'TeeItUp capped at 7 courses per run');
assert.equal(results['washington-national'].days[d0], '0703,166,2;1142,166,4;1600,166,1', 'Chronogolf records largest group that fits');
assert.equal(results['the-home-course'].days[d0], '1533,62,4', 'foreUP drops full times');
console.log(`All tests passed (${Object.keys(results).length} courses with results, ${Object.keys(weather).length} with rain).`);
await fs.rm(tmp, { recursive: true, force: true });
