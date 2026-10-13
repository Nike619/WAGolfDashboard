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
