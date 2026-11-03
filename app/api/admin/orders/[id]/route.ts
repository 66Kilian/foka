import { guard, json } from '@/lib/server/auth';
import { db } from '@/lib/server/db';
import { OrderPatch, issues } from '@/lib/server/schema';

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const deny = await guard();
  if (deny) return deny;
  const { id } = await ctx.params;
  const p = OrderPatch.safeParse(await req.json().catch(() => null));
  if (!p.success) return json({ error: issues(p.error) }, 400);
  const o = await db.getOrder(id);
  if (!o) return json({ error: 'Nincs ilyen rendelés.' }, 404);
  const { notified, ...rest } = p.data;
  const next = { ...o, ...rest, ...(notified ? { notified: { ...o.notified, ...notified } } : {}) };
  await db.putOrder(next, false);
  return json(next);
}
