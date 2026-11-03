import 'server-only';
import { createHmac, timingSafeEqual, createHash } from 'node:crypto';
import { cookies, headers } from 'next/headers';

const COOKIE = 'zolgiz_admin';
const DAYS = 30;

/** Admin jelszó: Vercel → Settings → Environment Variables → ADMIN_PASSWORD. Helyben alapból „konyha”. */
export function adminPassword(): string | null {
  const p = process.env.ADMIN_PASSWORD;
  if (p) return p;
  return process.env.NODE_ENV === 'production' ? null : 'konyha';
}

function secret() {
  // Ha a jelszó megváltozik, minden régi belépés érvénytelen lesz.
  return process.env.SESSION_SECRET || `zolgiz:${adminPassword() ?? ''}`;
}

const sign = (v: string) => createHmac('sha256', secret()).update(v).digest('base64url');

function safeEq(a: string, b: string) {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function checkPassword(input: string) {
  const p = adminPassword();
  return !!p && safeEq(input, p);
}

export async function startSession() {
  const exp = String(Date.now() + DAYS * 864e5);
  (await cookies()).set(COOKIE, `${exp}.${sign(exp)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: DAYS * 86400,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export async function isAdmin() {
  if (!adminPassword()) return false;
  const v = (await cookies()).get(COOKIE)?.value;
  if (!v) return false;
  const [exp, sig] = v.split('.');
  if (!exp || !sig || +exp < Date.now()) return false;
  return safeEq(sig, sign(exp));
}

/** Más oldalról indított kérés (CSRF) kiszűrése a módosító végpontokon */
export async function sameOrigin() {
  const h = await headers();
  const origin = h.get('origin');
  if (!origin) return h.get('sec-fetch-site') !== 'cross-site';
  try {
    return new URL(origin).host === (h.get('x-forwarded-host') || h.get('host'));
  } catch {
    return false;
  }
}

export async function clientIp() {
  const h = await headers();
  return (h.get('x-forwarded-for') || '').split(',')[0].trim() || h.get('x-real-ip') || 'local';
}

export const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

/** Admin végpontok elején: null = mehet, különben a hibaválasz */
export async function guard(mutating = true): Promise<Response | null> {
  if (!(await isAdmin())) return json({ error: 'Lejárt a belépés. Lépj be újra.' }, 401);
  if (mutating && !(await sameOrigin())) return json({ error: 'Tiltott kérés.' }, 403);
  return null;
}
