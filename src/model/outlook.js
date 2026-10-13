// Today's golf outlook for the loading screen: a headline, a verdict and a few short lines, from each
// course's conditions today. No DOM; tested in Node.
// Input: [{ ground: 'dry'|'damp'|'soft'|'soggy'|'snow'|null, rain, chance, low, high, code, frost: 'HH:MM'|null }]

// WMO weather codes (Open-Meteo) → sky, grouped.
export function sky(code) {
  if (code == null) return null;
  if (code === 0) return { key: 'sun', label: 'Sunny' };
  if (code <= 2) return { key: 'partly', label: 'Partly cloudy' };
  if (code === 3) return { key: 'cloud', label: 'Cloudy' };
  if (code <= 48) return { key: 'fog', label: 'Foggy' };
  if (code <= 57) return { key: 'rain', label: 'Drizzle' };
  if (code <= 67 || (code >= 80 && code <= 82)) return { key: 'rain', label: code >= 80 ? 'Showers' : 'Rain' };
  if (code <= 77 || code === 85 || code === 86) return { key: 'snow', label: 'Snow' };
  if (code >= 95) return { key: 'storm', label: 'Thunderstorms' };
  return { key: 'cloud', label: 'Cloudy' };
}

const median = xs => { const v = xs.filter(x => x != null).sort((a, b) => a - b); return v.length ? v[Math.floor((v.length - 1) / 2)] : null; };
const mode = xs => { const c = new Map(); for (const x of xs) if (x != null) c.set(x, (c.get(x) || 0) + 1); let best = null, n = 0; for (const [k, v] of c) if (v > n) { best = k; n = v; } return best; };
const fmt = hm => { let [h, m] = hm.split(':').map(Number); const ap = h >= 12 ? 'PM' : 'AM'; h = h % 12 || 12; return `${h}${m ? ':' + String(m).padStart(2, '0') : ''} ${ap}`; };

// ahead: true for tomorrow's forecast ("should be dry" rather than "playing dry").
export function outlook(days, { ahead = false } = {}) {
  const known = days.filter(d => d && d.ground);
  if (!known.length) return null;
  const n = known.length, count = k => known.filter(d => d.ground === k).length;
  const dry = count('dry'), soggy = count('soggy'), snowy = count('snow');
  const chance = median(known.map(d => d.chance)), rain = median(known.map(d => d.rain)) ?? 0;
  const high = median(known.map(d => d.high)), low = median(known.map(d => d.low));
  const s = sky(mode(known.map(d => d.code)));
  const frosty = known.filter(d => d.frost), thaw = frosty.length ? frosty.map(d => d.frost).sort()[Math.floor((frosty.length - 1) / 2)] : null;

  let verdict, tone;
  if (snowy > n / 2 || s?.key === 'snow') { verdict = 'Not a golf day'; tone = 'bad'; }
  else if (s?.key === 'storm') { verdict = 'Storms around, so watch the sky'; tone = 'bad'; }
  else if ((chance ?? 0) >= 70 && rain >= 0.2) { verdict = 'Wet day, so bring rain gear'; tone = 'bad'; }
  else if ((chance ?? 0) >= 40) { verdict = 'Showers possible'; tone = 'fair'; }
  else if (high != null && high < 45) { verdict = 'Chilly, so layer up'; tone = 'fair'; }
  else if (dry / n >= 0.6) { verdict = 'Great day for golf'; tone = 'good'; }
  else { verdict = 'Good day, soft in spots'; tone = 'fair'; }

  const lines = [`${dry} of ${n} courses ${ahead ? 'should be' : 'playing'} dry${soggy ? `, ${soggy} soggy` : ''}${snowy ? `, ${snowy} with snow` : ''}`];
  if (frosty.length) lines.push(`Frost delays likely at ${frosty.length} ${frosty.length === 1 ? 'course' : 'courses'}${thaw === '24:00' ? ' all day' : `, until about ${fmt(thaw)}`}`);
  lines.push(chance == null ? (rain >= 0.01 ? `About ${rain.toFixed(2)}" of rain` : 'No rain expected') : chance < 15 && rain < 0.01 ? 'No rain expected' : `${chance}% chance of rain${rain >= 0.01 ? `, about ${rain.toFixed(2)}"` : ''}`);
  if (low != null && high != null) lines.push(`${low}° to ${high}°F`);
  const headline = [s?.label, high != null ? `${high}°F` : null].filter(Boolean).join(' · ') || 'Golf outlook'; // older weather data has no sky or high
  return { headline, sky: s?.key || 'partly', verdict, tone, lines };
}
