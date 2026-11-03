import { z } from 'zod';
import { getContent } from '@/lib/server/content';
import { estimateDelivery } from '@/lib/server/eta';
import { clientIp, json } from '@/lib/server/auth';
import { db } from '@/lib/server/db';

const Body = z.object({ town: z.string().trim().min(1).max(60), street: z.string().trim().min(1).max(120) });

export async function POST(req: Request) {
  const body = Body.safeParse(await req.json().catch(() => null));
  if (!body.success) return json({ ok: false, reason: 'notfound' }, 400);
  // Az OpenStreetMap ingyenes – ne lehessen vele visszaélni
  if ((await db.incr(`rl:eta:${await clientIp()}`, 600)) > 40) return json({ ok: false, reason: 'network' }, 429);
  const c = await getContent();
  const r = await estimateDelivery(body.data.town, body.data.street, c);
  return json(r.ok && r.km > c.delivery.maxKm ? { ...r, far: true } : r);
}
