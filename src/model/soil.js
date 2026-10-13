// Soil → drainage score. Used by scripts/soils.mjs (to score USDA soil survey data) and by the page
// (to blend that score with researched drainage scores). No DOM; tested in Node.
//
// Inputs are SSURGO map-unit aggregates (table muaggatt): dominant drainage class, hydrologic soil
// group, flooding frequency, the shallowest annual water table (cm) and average slope (%); and from the
// dominant component: depth to a restrictive layer (cm, e.g. dense glacial till) and the slowest
// saturated hydraulic conductivity in the top 50 cm (ksat, µm/s). SSURGO maps the native soil,
// not what was built on it (sand caps, USGA greens, drain tile), so this is a starting estimate:
// golfer reports win where they exist.

const DRAINAGE = {
  'excessively drained': 5, 'somewhat excessively drained': 4.5, 'well drained': 4,
  'moderately well drained': 3, 'somewhat poorly drained': 2, 'poorly drained': 1.5, 'very poorly drained': 1,
};
// A = sand/gravel, infiltrates fast … D = clay or high water table. Dual groups (A/D) give the drained
// condition first; courses are drained, so that's used, a half point lower.
const GROUP = { A: 5, B: 4, C: 2.5, D: 1 };
const FLOOD = { none: 0, 'very rare': 0, rare: -0.25, occasional: -0.5, frequent: -1, 'very frequent': -1 };

// One map unit → 1–5, or null when the survey has no rating (Urban land, water, pits without data).
// Small adjustments, since drainage class and soil group already partly reflect these: a hardpan or
// bedrock near the surface perches water (−0.5 within 50 cm, −0.25 within 1 m); a slow layer in the
// top 50 cm holds it (−0.5 below 1.4 µm/s, −0.25 below 4) while very rapid soil sheds it (+0.25 above
// 40); steep ground drains (+0.25 at 15%+) and flat ground collects water (−0.25 at 2% or less).
export function unitScore({ drainage, group, flood, watertable, restrictCm, ksat, slope } = {}) {
  const d = DRAINAGE[String(drainage || '').toLowerCase()];
  const g0 = String(group || '').toUpperCase().trim(), g = GROUP[g0[0]] != null ? GROUP[g0[0]] - (g0.includes('/') ? 0.5 : 0) : undefined;
  if (d == null && g == null) return null;
  let s = d != null && g != null ? (d + g) / 2 : (d ?? g);
  s += FLOOD[String(flood || '').toLowerCase()] ?? 0;
  if (watertable != null && watertable !== '') { const w = Number(watertable); if (w < 30) s -= 1; else if (w < 60) s -= 0.5; }
  if (restrictCm != null) { if (restrictCm < 50) s -= 0.5; else if (restrictCm < 100) s -= 0.25; }
  if (ksat != null) { if (ksat < 1.4) s -= 0.5; else if (ksat < 4) s -= 0.25; else if (ksat > 40) s += 0.25; }
  if (slope != null) { if (slope >= 15) s += 0.25; else if (slope <= 2) s -= 0.25; }
  return Math.min(5, Math.max(1, s));
}

// Area-weighted score over the map units around a course. units: [{ area, ...unit }].
// coverage = share of the area that has a rating; below 40% there's no score.
export function siteScore(units) {
  const total = units.reduce((a, u) => a + (u.area || 0), 0);
  if (!total) return { score: null, coverage: 0 };
  let rated = 0, sum = 0;
  for (const u of units) { const s = unitScore(u); if (s != null) { rated += u.area; sum += s * u.area; } }
  const coverage = rated / total;
  return { score: coverage >= 0.4 ? Math.round(sum / rated * 10) / 10 : null, coverage: Math.round(coverage * 100) / 100 };
}

// Blend a course's researched drainage with its soil score:
// - high/medium confidence: keep the researched score (golfer reports beat native-soil maps);
// - low confidence with sources: average the two;
// - low confidence, no sources (the default 3): use the soil score.
// Adds c.soil for display and marks c.drainage.basis = 'research' | 'blend' | 'soil'.
export function withSoil(c, soil) {
  if (!soil) return c;
  const d = c.drainage || {}, out = { ...c, soil };
  if (soil.score == null) return out;
  if (d.confidence === 'high' || d.confidence === 'medium') return { ...out, drainage: { ...d, basis: 'research' } };
  const blend = (d.sources || []).length && d.score;
  return { ...out, drainage: { ...d, researched: d.score ?? null, score: Math.min(5, Math.max(1, Math.round(blend ? (d.score + soil.score) / 2 : soil.score))), basis: blend ? 'blend' : 'soil' } };
}

// Plain-language soil details for the course sheet, e.g. "dense glacial till about 2 ft down".
const KIND = { 'densic material': 'dense glacial till (hardpan)', duripan: 'cemented hardpan', fragipan: 'dense fragipan', ortstein: 'cemented layer', 'lithic bedrock': 'bedrock', 'paralithic bedrock': 'soft bedrock', 'petrocalcic': 'cemented lime layer' };
export function restrictText(u) {
  if (u.restrictCm == null) return '';
  const k = KIND[String(u.restrictKind || '').toLowerCase()] || String(u.restrictKind || 'restrictive layer').toLowerCase();
  const ft = u.restrictCm / 30.48;
  return `${k} ${ft < 1 ? 'under 1 ft' : 'about ' + Math.round(ft) + ' ft'} down`;
}
export function soakText(ksat) {
  if (ksat == null) return '';
  return ksat > 40 ? 'water soaks in very fast' : ksat >= 10 ? 'water soaks in fast' : ksat >= 4 ? 'water soaks in moderately' : ksat >= 1.4 ? 'water soaks in slowly' : 'water soaks in very slowly';
}

// Where a course's drainage score came from, worded the same everywhere it's shown.
// short: for list columns ("Golfer reports", "Soil survey", "Reports + soil"); long: for sheets.
export function drainSource(dr = {}, short = false) {
  if (dr.basis === 'soil') return short ? 'Soil survey' : 'From the USDA soil survey; no golfer reports found';
  if (dr.basis === 'blend') return short ? 'Reports + soil' : `Golfer reports (${dr.researched}/5) averaged with the USDA soil survey`;
  if (!dr.confidence) return '';
  const conf = dr.confidence[0].toUpperCase() + dr.confidence.slice(1);
  return short ? `Golfer reports · ${dr.confidence}` : `${conf} confidence, from golfer reports`;
}
