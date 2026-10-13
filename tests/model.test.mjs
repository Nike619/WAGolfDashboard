// Offline test for the page's model code (src/model/*.js): tee-time filtering and the ground-condition model.
// Run: node tests/model.test.mjs
import assert from 'node:assert';
import { parseDay, inWindow, openTimes, lowestPrice, isStale, bookLink } from '../src/model/teetimes.js';
import { wetness, rainOn, rainPct, dryKey, RETENTION } from '../src/model/ground.js';
import { isPub, hasTimes, inView } from '../src/model/courses.js';
import { shift } from '../src/lib/dates.js';

// ---------- tee times ----------
assert.deepEqual(parseDay('0710,55,4;1300,,2;1420,80,'), [{ t: '07:10', p: 55, s: 4 }, { t: '13:00', p: null, s: 2 }, { t: '14:20', p: 80, s: null }]);
assert.deepEqual(parseDay(''), []);
assert(inWindow('10:59', 'am') && !inWindow('11:00', 'am'));
assert(inWindow('11:00', 'mid') && !inWindow('14:00', 'mid') && inWindow('14:00', 'pm'));

const result = { days: { '2026-10-12': '0700,40,4;1200,60,2;1500,90,4', '2026-10-13': '0800,50,1' } };
const all = { players: 1, win: 'any', maxp: 0 };
const evening = { d: '2026-10-12', t: '13:00' };
assert.equal(openTimes(result, '2026-10-14', all, evening), null, 'unchecked date is null, not empty');
assert.deepEqual(openTimes(result, '2026-10-12', all, evening).map(x => x.t), ['15:00'], "today's past times are hidden");
assert.deepEqual(openTimes(result, '2026-10-12', all, { d: '2026-10-11', t: '23:00' }).length, 3, 'other days keep early times');
assert.deepEqual(openTimes(result, '2026-10-12', { ...all, players: 3 }, { d: '', t: '' }).map(x => x.t), ['07:00', '15:00'], 'needs enough open spots');
assert.deepEqual(openTimes(result, '2026-10-12', { ...all, maxp: 60 }, { d: '', t: '' }).map(x => x.p), [40, 60], 'max price');
assert.equal(lowestPrice(parseDay('0700,,4;0800,45,4')), 45);
assert.equal(lowestPrice(parseDay('0700,,4')), Infinity);
assert(isStale({ dataAt: '2026-10-12T00:00:00Z' }, Date.parse('2026-10-12T13:00:00Z')));
assert(!isStale({ checkedAt: '2026-10-12T02:00:00Z' }, Date.parse('2026-10-12T13:00:00Z')));
assert.equal(bookLink({ bookUrl: 'https://x/?date={date}&golfers={players}' }, '2026-10-13', 3), 'https://x/?date=2026-10-13&golfers=3');
assert.equal(bookLink({}, '2026-10-13', 3), null);

// ---------- ground conditions ----------
const day = '2026-10-12';
const rainW = (today, d1, d2, d3) => ({ days: { [day]: [today, 40], [shift(day, -1)]: [d1, null], [shift(day, -2)]: [d2, null], [shift(day, -3)]: [d3, null] } });
assert.equal(rainOn(rainW(0.3, 0, 0, 0), day), 0.3);
assert.equal(rainOn(undefined, day), 0);
assert.equal(rainPct(rainW(0, 0, 0, 0), day), 40);
assert.equal(rainPct(rainW(0, 0, 0, 0), shift(day, -1)), null);
assert.equal(wetness(undefined, 3, day), null, 'no rain data');
assert.equal(wetness(rainW(0, 0, 0, 0), undefined, day), null, 'no drainage score');

// index = (today + 1 day before + 0.6 × 2 before + 0.35 × 3 before) × retention
const w = wetness(rainW(0.1, 0.2, 0.5, 1), 3, day);
assert.ok(Math.abs(w.idx - (0.1 + 0.2 + 0.3 + 0.35) * RETENTION[3]) < 1e-9);
assert.ok(Math.abs(w.prior - 1.7) < 1e-9);
assert.equal(w.day, 0.1);
assert.equal(w.key, 'soggy');
// Same storm, different drainage: sand-capped stays dry, clay is soggy.
const storm = rainW(0, 0.2, 0, 0);
assert.deepEqual([5, 4, 3, 2, 1].map(s => wetness(storm, s, day).key), ['dry', 'dry', 'damp', 'damp', 'damp']); // 0.2 × 0.35 = 0.07 < 0.08
assert.deepEqual([5, 3, 1].map(s => wetness(rainW(0, 0.5, 0, 0), s, day).key), ['dry', 'soft', 'soggy']);
assert.equal(wetness(rainW(0, 0, 0, 0), 1, day).key, 'dry');
assert.equal(dryKey(null, 5), 0.1, 'no rain data: better drainage sorts drier');
assert.ok(dryKey(null, 5) < dryKey(null, 1));

// ---------- courses ----------
assert(isPub({}) && !isPub({ access: 'private' }));
assert(hasTimes({ platform: 'foreup' }) && !hasTimes({ platform: null }) && !hasTimes({ platform: 'link' }));
const c = { status: 'ready', access: 'public', region: 'South Sound' };
assert(inView(c, { access: 'public', region: '' }));
assert(inView(c, { access: 'public', region: 'South Sound' }));
assert(!inView(c, { access: 'public', region: 'North Sound' }));
assert(!inView(c, { access: 'private', region: '' }));
assert(!inView({ ...c, active: false }, { access: 'public', region: '' }));

console.log('All model tests passed.');

// ---------- sunset ----------
import { sunsetPT, sunsetAt } from '../src/model/sun.js';
const near = (hm, want, mins = 3) => { const m = s => Number(s.slice(0, 2)) * 60 + Number(s.slice(3)); assert.ok(Math.abs(m(hm) - m(want)) <= mins, `${hm} vs ${want}`); };
near(sunsetPT(47.61, -122.33, '2026-10-12'), '18:26'); // Seattle, PDT
near(sunsetPT(47.61, -122.33, '2026-06-21'), '21:11'); // longest day
near(sunsetPT(47.61, -122.33, '2026-12-21'), '16:20'); // shortest day, PST
near(sunsetPT(47.66, -117.43, '2026-10-12'), '18:07'); // Spokane is further east, so earlier
assert.equal(sunsetAt(80, 0, '2026-06-21'), null, 'no sunset in polar day');
const late = { days: { '2026-10-12': '1700,30,4;1820,30,4;2000,30,4;2220,30,4' } };
assert.deepEqual(openTimes(late, '2026-10-12', all, { d: '', t: '' }, '18:26').map(x => x.t), ['17:00', '18:20'], 'times after sunset are dropped');
assert.equal(openTimes(late, '2026-10-12', all, { d: '', t: '' }).length, 4, 'no sunset given: keep all');
console.log('Sunset tests passed.');

// ---------- soil ----------
import { unitScore, siteScore, withSoil } from '../src/model/soil.js';
assert.equal(unitScore({ drainage: 'Excessively drained', group: 'A' }), 5);
assert.equal(unitScore({ drainage: 'Well drained', group: 'B' }), 4);
assert.equal(unitScore({ drainage: 'Poorly drained', group: 'D', flood: 'Frequent' }), 1, 'floodplain clay bottoms out');
assert.equal(unitScore({ drainage: 'Moderately well drained', group: 'C', watertable: 45 }), 2.25, 'shallow water table costs half a point');
assert.equal(unitScore({ drainage: 'Somewhat poorly drained', group: 'A/D' }), 3.25, 'dual group uses the drained letter, half a point lower');
assert.equal(unitScore({ group: 'B' }), 4, 'group alone');
assert.equal(unitScore({ drainage: null, group: null }), null, 'Urban land has no rating');
assert.deepEqual(siteScore([{ area: 3, drainage: 'Well drained', group: 'A' }, { area: 1, drainage: 'Poorly drained', group: 'D' }]), { score: 3.7, coverage: 1 }, 'area-weighted: (3 × 4.5 + 1 × 1.25) / 4');
assert.deepEqual(siteScore([{ area: 1, drainage: 'Well drained', group: 'B' }, { area: 3 }]), { score: null, coverage: 0.25 }, 'mostly unrated: no score');
assert.deepEqual(siteScore([]), { score: null, coverage: 0 });

const research = { id: 'a', drainage: { score: 5, confidence: 'high', sources: [{}] } };
assert.equal(withSoil(research, { score: 2 }).drainage.score, 5, 'researched score wins');
assert.equal(withSoil(research, { score: 2 }).drainage.basis, 'research');
const unknown = { id: 'b', drainage: { score: 3, confidence: 'low', sources: [] } };
assert.equal(withSoil(unknown, { score: 4.6 }).drainage.score, 5, 'default 3 replaced by soil');
assert.equal(withSoil(unknown, { score: 4.6 }).drainage.basis, 'soil');
assert.equal(withSoil(unknown, { score: 4.6 }).drainage.researched, 3);
const weak = { id: 'c', drainage: { score: 2, confidence: 'low', sources: [{}] } };
assert.equal(withSoil(weak, { score: 4 }).drainage.score, 3, 'low confidence with sources: averaged');
assert.equal(withSoil(unknown, { score: null }).drainage.score, 3, 'no soil score: unchanged');
assert.equal(withSoil(unknown, undefined), unknown, 'no soil data: same object');
console.log('Soil tests passed.');

// ---------- drying, snow, frost ----------
import { evapOn, lowOn, frostOn, snowOn } from '../src/model/ground.js';
const wx = (today, before, et, extra = {}) => ({ days: {
  [day]: [today, 50, et, extra.low ?? null, extra.frost ?? null, extra.snow ?? 0],
  [shift(day, -1)]: [before, null, et], [shift(day, -2)]: [0, null, et], [shift(day, -3)]: [0, null, et] } });
// 0.5" yesterday on a drainage-3 course: Soft with no drying; a cool October (0.03"/day) still Soft;
// a July day (0.2"/day) dries it to Damp.
assert.equal(wetness(wx(0, 0.5, 0), 3, day).key, 'soft');
assert.equal(wetness(wx(0, 0.5, 0.03), 3, day).key, 'soft');
const july = wetness(wx(0, 0.5, 0.2), 3, day);
assert.equal(july.key, 'damp', 'summer drying');
assert.ok(Math.abs(july.dried - 0.32) < 1e-9, 'only drying on or after the rain day counts: 2 days × 0.16"');
assert.ok(Math.abs(july.idx - 0.18 * 0.6) < 1e-9);
assert.ok(Math.abs(wetness(wx(0.5, 0, 0.2), 3, day).dried - 0.16) < 1e-9, 'rain today: only today\'s drying');
assert.equal(wetness(wx(0, 0.1, 0.2), 3, day).idx, 0, 'drying more than the rain: never below zero');
const snowy = wetness(wx(0, 0, 0, { snow: 2.5 }), 5, day);
assert.equal(snowy.key, 'snow', 'snow on the ground overrides drainage');
assert.equal(snowy.label, 'Snow');
assert.ok(dryKey(snowy, 5) > dryKey(wetness(wx(0, 2, 0), 1, day), 1), 'snow sorts after the soggiest course');
assert.equal(wetness(wx(0, 0, 0, { snow: 0.5 }), 3, day).key, 'dry', 'a dusting is not "Snow"');
const v = wx(0, 0, 0.04, { low: 28, frost: '10:00', snow: 0 });
assert.equal(evapOn(v, day), 0.04);
assert.equal(lowOn(v, day), 28);
assert.equal(frostOn(v, day), '10:00');
assert.equal(snowOn(v, day), 0);
assert.equal(frostOn({ days: { [day]: [0.1, 20] } }, day), null, 'old two-field weather: no frost');
assert.equal(lowOn({ days: { [day]: [0.1, 20] } }, day), null);
console.log('Drying, snow and frost tests passed.');
