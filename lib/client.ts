'use client';
// Böngészős segédek: hang, localStorage, API hívás

let ctx: AudioContext | null = null;
export function unlockAudio() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = ctx || new AC();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch { /* nem támogatott */ }
  return ctx;
}

export function chime(notes = [659.25, 880], gap = 0.16) {
  if (!ctx) return;
  try {
    const t0 = ctx.currentTime;
    notes.forEach((f, i) => {
      const o = ctx!.createOscillator();
      const g = ctx!.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      const t = t0 + i * gap;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.45, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g).connect(ctx!.destination);
      o.start(t);
      o.stop(t + 0.55);
    });
  } catch { /* */ }
}

export const ls = {
  get<T>(k: string, fb: T): T { try { const v = localStorage.getItem(k); return v == null ? fb : (JSON.parse(v) as T); } catch { return fb; } },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* privát mód */ } },
  del(k: string) { try { localStorage.removeItem(k); } catch { /* */ } },
};

export class ApiError extends Error {
  constructor(message: string, public status: number, public data?: unknown) { super(message); }
}

export async function api<T>(url: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  let r: Response;
  try {
    r = await fetch(url, {
      ...rest,
      headers: { ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(rest.headers || {}) },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      cache: 'no-store',
    });
  } catch {
    throw new ApiError('Nincs internetkapcsolat.', 0);
  }
  const data = await r.json().catch(() => null);
  if (!r.ok) throw new ApiError((data as { error?: string } | null)?.error || `Hiba (${r.status})`, r.status, data);
  return data as T;
}
