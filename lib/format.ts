const nf = new Intl.NumberFormat('hu-HU');
const tf = new Intl.DateTimeFormat('hu-HU', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Budapest' });
const tfs = new Intl.DateTimeFormat('hu-HU', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Budapest' });

export const MIN = 60_000;
export const ft = (n: number) => `${nf.format(Math.round(n))} Ft`;
export const km = (n: number) => `${n.toLocaleString('hu-HU', { maximumFractionDigits: 1 })} km`;
export const hhmm = (ms: number) => tf.format(new Date(ms));
export const hhmmss = (ms: number) => tfs.format(new Date(ms));

export function mmss(ms: number) {
  const s = Math.max(0, Math.round(Math.abs(ms) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function ago(ms: number, now = Date.now()) {
  const m = Math.floor((now - ms) / MIN);
  if (m < 1) return 'most';
  if (m < 60) return `${m} perce`;
  return `${Math.floor(m / 60)} ó ${m % 60} p`;
}

/** Magyar mobilszám → +36… (null, ha érvénytelen) */
export function normalizePhone(raw: string) {
  let d = String(raw || '').replace(/[^\d+]/g, '');
  if (d.startsWith('+')) d = d.slice(1);
  if (d.startsWith('06')) d = '36' + d.slice(2);
  if (!d.startsWith('36')) return null;
  return d.length === 11 ? `+${d}` : null;
}

export const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;

export function slugify(s: string) {
  return fold(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'tetel';
}
