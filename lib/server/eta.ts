import 'server-only';
// Kiszállítási idő a vevő címére:
// 1) cím → koordináta (OpenStreetMap Nominatim), 2) autós útvonal (OSRM),
// 3) ha az útvonaltervező nem elérhető: légvonal × útfaktor / átlagsebesség.
import { db } from './db';
import type { Content, EtaResult } from '../types';

const UA = 'ZolgizEtelbar/2.0 (online rendeles; kapcsolat: etterem)';

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (x: number) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

async function getJSON<T>(url: string, ms = 6000): Promise<T> {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'hu' }, signal: AbortSignal.timeout(ms), cache: 'no-store' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as T;
}

type NomRow = { lat: string; lon: string; type: string; addresstype?: string };

async function geocode(town: string, street: string) {
  const base = 'https://nominatim.openstreetmap.org/search?';
  let res = await getJSON<NomRow[]>(base + new URLSearchParams({ format: 'jsonv2', limit: '1', countrycodes: 'hu', street, city: town }));
  if (!res.length) res = await getJSON<NomRow[]>(base + new URLSearchParams({ format: 'jsonv2', limit: '1', countrycodes: 'hu', q: `${street}, ${town}` }));
  if (!res.length) return null;
  const r = res[0];
  const precise = ['building', 'house', 'residential', 'yes'].includes(r.type) || r.addresstype === 'building' || r.addresstype === 'place';
  return { lat: +r.lat, lng: +r.lon, precise };
}

export async function estimateDelivery(town: string, street: string, c: Content): Promise<EtaResult> {
  const key = `eta:${c.contact.lat},${c.contact.lng}:${town}|${street}`.toLowerCase().replace(/\s+/g, ' ').trim();
  const D = c.delivery;
  type Raw = { ok: true; km: number; driveMin: number | null; precise: boolean; lat: number; lng: number } | { ok: false; reason: 'notfound' };
  let raw = await db.get<Raw>(key).catch(() => null);

  if (!raw) {
    let pt;
    try { pt = await geocode(town, street); } catch { return { ok: false, reason: 'network' }; }
    if (!pt) {
      raw = { ok: false, reason: 'notfound' };
    } else {
      let kmv: number;
      let driveMin: number | null = null;
      try {
        const r = await getJSON<{ routes?: { distance: number; duration: number }[] }>(
          `https://router.project-osrm.org/route/v1/driving/${c.contact.lng},${c.contact.lat};${pt.lng},${pt.lat}?overview=false`,
        );
        const route = r.routes?.[0];
        if (!route) throw new Error('no route');
        kmv = route.distance / 1000;
        driveMin = route.duration / 60;
      } catch {
        kmv = haversineKm({ lat: c.contact.lat, lng: c.contact.lng }, pt) * D.roadFactor;
      }
      raw = { ok: true, km: kmv, driveMin, precise: pt.precise, lat: pt.lat, lng: pt.lng };
    }
    // Csak a sikeres útvonalat őrizzük sokáig; a hálózati becslést nem
    await db.set(key, raw, raw.ok && raw.driveMin == null ? 3600 : 60 * 60 * 24 * 14).catch(() => {});
  }

  if (!raw.ok) return raw;
  const minutes = raw.driveMin != null
    ? Math.ceil(raw.driveMin * D.trafficFactor + D.handoverMinutes)
    : Math.ceil((raw.km / D.fallbackKmh) * 60 + D.handoverMinutes);
  return { ok: true, km: Math.round(raw.km * 10) / 10, minutes, source: raw.driveMin != null ? 'route' : 'estimate', precise: raw.precise };
}
