import { NewOrder, issues } from '@/lib/server/schema';
import { getContent, getStatus } from '@/lib/server/content';
import { createOrder, OrderError, toPublic } from '@/lib/server/orders';
import { clientIp, json, sameOrigin } from '@/lib/server/auth';
import { db } from '@/lib/server/db';

export async function POST(req: Request) {
  if (!(await sameOrigin())) return json({ error: 'Tiltott kérés.' }, 403);
  const parsed = NewOrder.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json({ error: 'Hiányos rendelés: ' + issues(parsed.error) }, 400);
  if ((await db.incr(`rl:order:${await clientIp()}`, 900)) > 8) {
    return json({ error: 'Túl sok rendelés rövid idő alatt. Hívj minket telefonon!' }, 429);
  }
  try {
    const [c, s] = await Promise.all([getContent(), getStatus()]);
    const o = await createOrder(parsed.data, c, s);
    return json(toPublic(o), 201);
  } catch (e) {
    if (e instanceof OrderError) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: 'Szerverhiba. Próbáld újra.' }, 500);
  }
}
