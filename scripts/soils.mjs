// Writes data/soils.json: the native soil around each course from the USDA NRCS soil survey (SSURGO),
// queried through Soil Data Access, scored 1–5 for drainage by src/model/soil.js.
// Runs from .github/workflows/soils.yml (by hand, or when this script changes). Soils don't change, so
// it doesn't need to run daily. Node 20+, no dependencies. Read-only queries to a public USDA service.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { siteScore } from '../src/model/soil.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'data');
const SDA = 'https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest';
const RADIUS_M = 400; // a circle about the size of a course
const PACE_MS = 400;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// A 16-sided polygon around a point, as WKT (lon lat order).
export function circleWkt(lat, lon, r = RADIUS_M) {
  const dLat = r / 111320, dLon = r / (111320 * Math.cos(lat * Math.PI / 180));
  const pts = [...Array(16)].map((_, i) => { const a = i / 16 * 2 * Math.PI; return `${(lon + dLon * Math.cos(a)).toFixed(6)} ${(lat + dLat * Math.sin(a)).toFixed(6)}`; });
  return `POLYGON((${[...pts, pts[0]].join(', ')}))`;
}

const ATTRS = 'mu.muname, ma.drclassdcd AS drainage, ma.hydgrpdcd AS soilgroup, ma.flodfreqdcd AS flood, ma.wtdepannmin AS watertable';
// Map units inside the circle with the area each covers (geometry area in degrees², fine as a weight).
export const areaQuery = wkt => `DECLARE @aoi geometry = geometry::STGeomFromText('${wkt}', 4326);
SELECT a.mukey, a.area, ${ATTRS}
FROM (SELECT P.mukey, SUM(P.mupolygongeo.STIntersection(@aoi).STArea()) AS area
      FROM mupolygon AS P WHERE P.mupolygongeo.STIntersects(@aoi) = 1 GROUP BY P.mukey) AS a
JOIN mapunit AS mu ON mu.mukey = a.mukey
LEFT JOIN muaggatt AS ma ON ma.mukey = a.mukey`;
// Fallback if the area query is refused: the map units the circle touches, weighted equally.
export const touchQuery = wkt => `SELECT m.mukey, 1 AS area, ${ATTRS}
FROM SDA_Get_Mukey_from_intersection_with_WktWgs84('${wkt}') AS m
JOIN mapunit AS mu ON mu.mukey = m.mukey
LEFT JOIN muaggatt AS ma ON ma.mukey = m.mukey`;

// Soil Data Access "JSON+COLUMNNAME" answers { Table: [[col names…], [row…], …] }.
export function parseRows(json) {
  const [cols, ...rows] = json?.Table || [];
  if (!cols) return [];
  return rows.map(r => Object.fromEntries(cols.map((c, i) => [c, r[i]])));
}
export const toUnit = r => ({ name: r.muname, area: Number(r.area) || 0, drainage: r.drainage || null, group: r.soilgroup || null, flood: r.flood || null, watertable: r.watertable === '' || r.watertable == null ? null : Number(r.watertable) });

async function sda(query, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(SDA, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, format: 'JSON+COLUMNNAME' }), signal: AbortSignal.timeout(60000) });
      const text = await r.text();
      if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status}: ${text.slice(0, 300)}`), { status: r.status });
      return text.trim() ? JSON.parse(text) : {}; // an empty body means no rows
    } catch (e) {
      last = e;
      if (e.status >= 400 && e.status < 500) throw e; // a bad query won't get better
      await sleep(3000 * (i + 1));
    }
  }
  throw last;
}

// Soil around one course: map units by share of area, plus the drainage score.
export async function courseSoil(c, query = sda) {
  const wkt = circleWkt(c.lat, c.lon);
  let method = 'area', rows;
  try { rows = parseRows(await query(areaQuery(wkt))); }
  catch (e) { console.log(`  area query failed for ${c.id} (${String(e.message).slice(0, 160)}); using touch query`); rows = null; }
  // No rows can also mean the spatial match didn't work (e.g. a coordinate-system mismatch), so try the other query.
  if (!rows?.length) { method = 'touch'; rows = parseRows(await query(touchQuery(wkt))); }
  const units = rows.map(toUnit).filter(u => u.area > 0);
  const { score, coverage } = siteScore(units);
  const total = units.reduce((a, u) => a + u.area, 0) || 1;
  return {
    score, coverage, method,
    units: units.sort((a, b) => b.area - a.area).slice(0, 4).map(({ area, ...u }) => ({ ...u, share: Math.round(area / total * 100) / 100 })),
  };
}

async function main() {
  const courses = JSON.parse(await fs.readFile(path.join(DATA, 'courses.json'), 'utf8')).filter(c => c.active !== false && typeof c.lat === 'number' && typeof c.lon === 'number');
  const out = { generatedAt: new Date().toISOString(), source: 'USDA NRCS SSURGO via Soil Data Access', radiusM: RADIUS_M, courses: {} };
  let failed = 0;
  for (const c of courses) {
    try {
      const s = out.courses[c.id] = await courseSoil(c);
      console.log(`ok   ${c.id}: ${s.score ?? '—'} (${s.method}, ${Math.round(s.coverage * 100)}% rated) ${s.units[0]?.name || 'no map units'}`);
    } catch (e) { failed++; console.log(`FAIL ${c.id}: ${String(e.message).slice(0, 200)}`); }
    await sleep(PACE_MS);
  }
  // How the soil score compares with researched scores, to judge whether it's worth trusting.
  const check = courses.filter(c => ['high', 'medium'].includes(c.drainage?.confidence) && out.courses[c.id]?.score != null);
  if (check.length) {
    console.log('\nResearched score vs soil score (high/medium confidence courses):');
    for (const c of check.sort((a, b) => b.drainage.score - a.drainage.score)) console.log(`  ${c.drainage.score}  ${String(out.courses[c.id].score).padEnd(4)} ${c.id}`);
    const diff = check.reduce((a, c) => a + Math.abs(c.drainage.score - out.courses[c.id].score), 0) / check.length;
    console.log(`  mean absolute difference: ${diff.toFixed(2)} over ${check.length} courses`);
  }
  if (failed === courses.length) { console.error('Every soil query failed; data/soils.json not written.'); process.exit(1); }
  await fs.writeFile(path.join(DATA, 'soils.json'), JSON.stringify(out) + '\n');
  console.log(`\nWrote soils for ${Object.keys(out.courses).length} of ${courses.length} courses (${failed} failed).`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch(e => { console.error(e); process.exit(1); });
