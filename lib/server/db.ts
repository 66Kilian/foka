import 'server-only';
// Tárolás:
//  - Vercelen: Upstash Redis (Vercel → Storage → Upstash for Redis). A változókat a Vercel magától beállítja.
//  - Helyben (npm run dev): .data/db.json fájl, nem kell semmit beállítani.
import { Redis } from '@upstash/redis';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { Order } from '../types';

const ORDER_TTL = 60 * 60 * 24 * 45; // 45 napig őrizzük a rendeléseket

interface Store {
  kind: 'redis' | 'file' | 'temp';
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSec?: number): Promise<void>;
  incr(key: string, ttlSec: number): Promise<number>;
  putOrder(o: Order, isNew: boolean): Promise<void>;
  getOrder(id: string): Promise<Order | null>;
  listOrders(since: number): Promise<Order[]>;
}

/* ---------------- Redis ---------------- */
function redisStore(r: Redis): Store {
  return {
    kind: 'redis',
    async get<T>(key: string) { return (await r.get<T>(key)) ?? null; },
    async set(key, value, ttlSec) { ttlSec ? await r.set(key, value, { ex: ttlSec }) : await r.set(key, value); },
    async incr(key, ttlSec) {
      const n = await r.incr(key);
      if (n === 1) await r.expire(key, ttlSec);
      return n;
    },
    async putOrder(o, isNew) {
      await r.set(`order:${o.id}`, o, { ex: ORDER_TTL });
      if (isNew) await r.zadd('orders', { score: o.createdAt, member: o.id });
    },
    async getOrder(id) { return (await r.get<Order>(`order:${id}`)) ?? null; },
    async listOrders(since) {
      const ids = await r.zrange<string[]>('orders', since, '+inf', { byScore: true });
      if (!ids.length) return [];
      const rows = await r.mget<(Order | null)[]>(...ids.map((id) => `order:${id}`));
      return rows.filter((x): x is Order => !!x);
    },
  };
}

/* ---------------- Fájl (helyi fejlesztés) ---------------- */
type FileData = { kv: Record<string, { v: unknown; exp?: number }>; orders: Record<string, Order> };

function fileStore(dir: string, kind: 'file' | 'temp'): Store {
  const file = path.join(dir, 'db.json');
  let data: FileData | null = null;
  let writing = Promise.resolve();

  async function load(): Promise<FileData> {
    if (data) return data;
    try { data = JSON.parse(await fs.readFile(file, 'utf8')) as FileData; } catch { data = { kv: {}, orders: {} }; }
    return data;
  }
  function save() {
    const snapshot = JSON.stringify(data);
    writing = writing.then(async () => {
      await fs.mkdir(dir, { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      await fs.writeFile(tmp, snapshot);
      await fs.rename(tmp, file);
    }).catch((e) => console.error('db write', e));
    return writing;
  }
  const alive = (e?: { exp?: number }) => !!e && (!e.exp || e.exp > Date.now());

  return {
    kind,
    async get<T>(key: string) { const d = await load(); const e = d.kv[key]; return alive(e) ? (e.v as T) : null; },
    async set(key, value, ttlSec) { const d = await load(); d.kv[key] = { v: value, exp: ttlSec ? Date.now() + ttlSec * 1000 : undefined }; await save(); },
    async incr(key, ttlSec) {
      const d = await load();
      const e = d.kv[key];
      const n = (alive(e) ? Number(e.v) : 0) + 1;
      d.kv[key] = { v: n, exp: alive(e) ? e.exp : Date.now() + ttlSec * 1000 };
      await save();
      return n;
    },
    async putOrder(o) { const d = await load(); d.orders[o.id] = o; await save(); },
    async getOrder(id) { const d = await load(); return d.orders[id] ?? null; },
    async listOrders(since) {
      const d = await load();
      return Object.values(d.orders).filter((o) => o.createdAt >= since).sort((a, b) => a.createdAt - b.createdAt);
    },
  };
}

function create(): Store {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return redisStore(new Redis({ url, token }));
  // Vercelen nincs írható lemez a /tmp-n kívül, és az sem közös a példányok között → csak átmeneti
  if (process.env.VERCEL) return fileStore('/tmp/zolgiz', 'temp');
  return fileStore(path.join(process.cwd(), '.data'), 'file');
}

const g = globalThis as unknown as { __zolgizDb?: Store };
export const db: Store = g.__zolgizDb ?? (g.__zolgizDb = create());
