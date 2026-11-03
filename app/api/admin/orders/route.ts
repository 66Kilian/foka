import { guard, json } from '@/lib/server/auth';
import { db } from '@/lib/server/db';
import { getStatus, storageKind } from '@/lib/server/content';

export const dynamic = 'force-dynamic';

/** Rendelések (alapból az utolsó 24 óra) + napi állapot egy kérésben – a konyha pár másodpercenként hívja */
export async function GET(req: Request) {
  const deny = await guard(false);
  if (deny) return deny;
  const days = Math.min(31, Math.max(1, Number(new URL(req.url).searchParams.get('days')) || 1));
  const [orders, status] = await Promise.all([db.listOrders(Date.now() - days * 864e5), getStatus()]);
  return json({ orders, status, storage: storageKind(), now: Date.now() });
}
