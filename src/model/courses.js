// Course-record helpers. No DOM; tested in Node.
export const isPub = c => (c.access || 'public') === 'public';
export const hasTimes = c => !!c.platform && c.platform !== 'link';
export function inView(c, pref) {
  return c.active !== false && c.status === 'ready' && (pref.access === 'private' ? !isPub(c) : isPub(c)) && (!pref.region || c.region === pref.region);
}
