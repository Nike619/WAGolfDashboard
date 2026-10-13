// Soil → drainage score. Used by scripts/soils.mjs (to score USDA soil survey data) and by the page
// (to blend that score with researched drainage scores). No DOM; tested in Node.
//
// Inputs are SSURGO map-unit aggregates (table muaggatt): dominant drainage class, hydrologic soil
// group, flooding frequency and the shallowest annual water table (cm). SSURGO maps the native soil,
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
export function unitScore({ drainage, group, flood, watertable } = {}) {
  const d = DRAINAGE[String(drainage || '').toLowerCase()];
  const g0 = String(group || '').toUpperCase().trim(), g = GROUP[g0[0]] != null ? GROUP[g0[0]] - (g0.includes('/') ? 0.5 : 0) : undefined;
  if (d == null && g == null) return null;
  let s = d != null && g != null ? (d + g) / 2 : (d ?? g);
  s += FLOOD[String(flood || '').toLowerCase()] ?? 0;
  if (watertable != null && watertable !== '') { const w = Number(watertable); if (w < 30) s -= 1; else if (w < 60) s -= 0.5; }
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
