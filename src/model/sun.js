// Sunset from latitude/longitude, using the standard sunrise equation (accurate to about a minute).
// No DOM; tested in Node. Used to hide tee times that start after dark.
import { TZ } from '../lib/dates.js';

const RAD = Math.PI / 180;

// Sunset for a local date (YYYY-MM-DD) as a Date, or null during polar day/night.
export function sunsetAt(lat, lon, date) {
  const [y, m, d] = date.split('-').map(Number);
  const n = Math.round(Date.UTC(y, m - 1, d, 12) / 864e5 + 2440587.5 - 2451545);
  const J = n - lon / 360;                                              // mean solar noon
  const M = (357.5291 + 0.98560028 * J) % 360;                          // solar mean anomaly
  const C = 1.9148 * Math.sin(M * RAD) + 0.02 * Math.sin(2 * M * RAD) + 0.0003 * Math.sin(3 * M * RAD);
  const L = (M + C + 180 + 102.9372) % 360;                             // ecliptic longitude
  const transit = 2451545 + J + 0.0053 * Math.sin(M * RAD) - 0.0069 * Math.sin(2 * L * RAD);
  const dec = Math.asin(Math.sin(L * RAD) * Math.sin(23.4397 * RAD));
  const cosW = (Math.sin(-0.833 * RAD) - Math.sin(lat * RAD) * Math.sin(dec)) / (Math.cos(lat * RAD) * Math.cos(dec));
  if (cosW < -1 || cosW > 1) return null;
  return new Date((transit + Math.acos(cosW) / RAD / 360 - 2440587.5) * 864e5);
}

// Sunset as Pacific 'HH:MM', or null.
export function sunsetPT(lat, lon, date) {
  const t = sunsetAt(lat, lon, date);
  return t && t.toLocaleTimeString('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
}
