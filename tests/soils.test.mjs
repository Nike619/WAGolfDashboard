// Offline test for scripts/soils.mjs: no network, Soil Data Access answers are mocked.
// Run: node tests/soils.test.mjs
import assert from 'node:assert';
import { circleWkt, parseRows, courseSoil, areaQuery, touchQuery, detailsQuery } from '../scripts/soils.mjs';

const wkt = circleWkt(47.2, -122.57);
assert.match(wkt, /^POLYGON\(\(-122\.\d+ 47\.\d+(, -?\d+\.\d+ \d+\.\d+){16}\)\)$/, '17 points, closed ring, lon lat order');
const pts = wkt.slice(9, -2).split(', ');
assert.equal(pts[0], pts[16], 'ring is closed');
assert.ok(areaQuery(wkt).includes(wkt) && touchQuery(wkt).includes(wkt));

const T = (...rows) => ({ Table: [['mukey', 'area', 'muname', 'drainage', 'soilgroup', 'flood', 'watertable'], ...rows] });
assert.deepEqual(parseRows(T(['1', '0.5', 'Everett', 'Well drained', 'A', 'None', ''])), [{ mukey: '1', area: '0.5', muname: 'Everett', drainage: 'Well drained', soilgroup: 'A', flood: 'None', watertable: '' }]);
assert.deepEqual(parseRows({}), [], 'empty answer: no rows');

const course = { id: 'x', lat: 47.2, lon: -122.57 };
// Area query works: units weighted by area, largest first.
let s = await courseSoil(course, async q => T(['1', '3', 'Everett gravelly sandy loam', 'Somewhat excessively drained', 'A', 'None', ''], ['2', '1', 'Urban land', '', '', '', '']));
assert.equal(s.method, 'area');
assert.equal(s.score, 4.8);
assert.equal(s.coverage, 0.75);
assert.deepEqual(s.units.map(u => [u.name, u.share]), [['Everett gravelly sandy loam', 0.75], ['Urban land', 0.25]]);
// Area query refused: falls back to the touch query.
const asked = [];
s = await courseSoil(course, async q => { asked.push(q.includes('corestrictions') ? 'details' : q.includes('mupolygonkey') ? 'area' : 'touch'); if (q.includes('mupolygonkey')) throw new Error('HTTP 500: bad'); return T(['3', '1', 'Puyallup', 'Poorly drained', 'B/D', 'Frequent', '20']); });
assert.deepEqual(asked, ['area', 'touch', 'details']);
assert.equal(s.method, 'touch');
assert.equal(s.score, 1, 'floodplain with a high water table');
assert.equal(s.fallback, 'HTTP 500: bad', 'records why it fell back');
// Area query matches nothing: also falls back.
s = await courseSoil(course, async q => q.includes('mupolygonkey') ? {} : T(['4', '1', 'Alderwood', 'Moderately well drained', 'B', 'None', '60']));
assert.equal(s.method, 'touch');
assert.equal(s.score, 3.5);
assert.equal(s.fallback, 'area query returned no rows');
// Details query: hardpan, soak-in rate, slope and texture merged into the units, and they move the score.
s = await courseSoil(course, async q => q.includes('corestrictions')
  ? { Table: [['mukey', 'slope', 'restrict_cm', 'restrict_kind', 'ksat_min', 'sand', 'clay'], ['4', '1', '61', 'Densic material', '1.2', '62', '8']] }
  : T(['4', '1', 'Alderwood gravelly sandy loam', 'Moderately well drained', 'B', 'None', '']));
assert.deepEqual(s.units[0], { name: 'Alderwood gravelly sandy loam', drainage: 'Moderately well drained', group: 'B', flood: 'None', watertable: null, slope: 1, restrictCm: 61, restrictKind: 'Densic material', ksat: 1.2, sand: 62, clay: 8, share: 1 });
assert.equal(s.score, 2.5, '3.5 − 0.25 (till within 1 m) − 0.5 (very slow layer) − 0.25 (flat)');
// Details query fails: score without them, and the reason is kept.
s = await courseSoil(course, async q => { if (q.includes('corestrictions')) throw new Error('HTTP 500: no OUTER APPLY'); return T(['4', '1', 'Alderwood', 'Moderately well drained', 'B', 'None', '']); });
assert.equal(s.score, 3.5);
assert.equal(s.detailsError, 'HTTP 500: no OUTER APPLY');
assert.match(detailsQuery(['4', '7', 'x']), /IN \(4,7\)$/, 'mukeys are numbers only');
console.log('Soil script tests passed.');
