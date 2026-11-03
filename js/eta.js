// Kiszállítási idő becslése a vásárló címéhez.
// 1) Cím → koordináta: OpenStreetMap Nominatim
// 2) Útvonal: OSRM (autós útvonal, valódi utakon)
// 3) Ha az útvonaltervező nem elérhető: légvonal × útfaktor / átlagsebesség
import { CONFIG } from './config.js';

const cache = new Map();
const D = CONFIG.delivery;
const R = CONFIG.restaurant;

function haversineKm(a, b) {
  const rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

async function getJSON(url, signal, ms = 6000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  signal?.addEventListener('abort', () => ctl.abort());
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { 'Accept-Language': 'hu' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally {
    clearTimeout(t);
  }
}

async function geocode(town, street, signal) {
  const params = new URLSearchParams({ format: 'jsonv2', limit: '1', countrycodes: 'hu', street, city: town });
  let res = await getJSON(`https://nominatim.openstreetmap.org/search?${params}`, signal);
  if (!res.length) {
    // második próba: szabad szöveges keresés
    const q = new URLSearchParams({ format: 'jsonv2', limit: '1', countrycodes: 'hu', q: `${street}, ${town}` });
    res = await getJSON(`https://nominatim.openstreetmap.org/search?${q}`, signal);
  }
  if (!res.length) return null;
  const precise = ['building', 'house', 'residential', 'yes'].includes(res[0].type) || res[0].addresstype === 'building' || res[0].addresstype === 'place';
  return { lat: +res[0].lat, lng: +res[0].lon, precise };
}

/**
 * @returns {Promise<{ok:true, km:number, minutes:number, lat:number, lng:number, source:'route'|'estimate', precise:boolean} | {ok:false, reason:'notfound'|'network'}>}
 */
export async function estimateDelivery(town, street, signal) {
  const key = `${town}|${street}`.toLowerCase().replace(/\s+/g, ' ').trim();
  if (cache.has(key)) return cache.get(key);

  let pt;
  try {
    pt = await geocode(town, street, signal);
  } catch (e) {
    if (signal?.aborted) throw e;
    return { ok: false, reason: 'network' };
  }
  if (!pt) return { ok: false, reason: 'notfound' };

  let result;
  try {
    const r = await getJSON(`https://router.project-osrm.org/route/v1/driving/${R.lng},${R.lat};${pt.lng},${pt.lat}?overview=false`, signal);
    const route = r.routes?.[0];
    if (!route) throw new Error('no route');
    result = {
      km: route.distance / 1000,
      minutes: Math.ceil((route.duration / 60) * D.trafficFactor + D.handoverMinutes),
      source: 'route',
    };
  } catch (e) {
    if (signal?.aborted) throw e;
    const k = haversineKm(R, pt) * D.roadFactor;
    result = { km: k, minutes: Math.ceil((k / D.fallbackKmh) * 60 + D.handoverMinutes), source: 'estimate' };
  }
  const out = { ok: true, ...result, lat: pt.lat, lng: pt.lng, precise: pt.precise };
  cache.set(key, out);
  return out;
}
