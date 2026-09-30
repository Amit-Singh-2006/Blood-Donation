export interface Point { latitude: number; longitude: number }

/** Straight-line distance in km (haversine). */
export const distanceKm = (a: Point, b: Point): number => {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.latitude - a.latitude) / 2) ** 2
    + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

/**
 * A rough arrival estimate from straight-line distance: roads add about 40%
 * and city traffic averages around 25 km/h. Shown as "about", never exact.
 */
export const etaMinutes = (km: number): number => Math.max(1, Math.round((km * 1.4 / 25) * 60));

/** "just now", "40 s ago", "3 min ago" */
export const agoText = (iso: string, now = Date.now()): string => {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 10) return 'just now';
  if (s < 60) return `${s} s ago`;
  return `${Math.round(s / 60)} min ago`;
};

/** Google Maps directions to a point (or a place name when there are no coordinates). */
export const directionsUrl = (to: Point | string, from?: Point) =>
  `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(typeof to === 'string' ? to : `${to.latitude},${to.longitude}`)}`
  + (from ? `&origin=${from.latitude},${from.longitude}` : '');
