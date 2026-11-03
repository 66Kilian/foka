import { db } from '@/lib/server/db';
import { toPublic } from '@/lib/server/orders';
import { json } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

/** Rendeléskövetés: a (kitalálhatatlan) azonosítóval a vevő a saját rendelését látja */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/.test(id)) return json({ error: 'Nincs ilyen rendelés.' }, 404);
  const o = await db.getOrder(id);
  if (!o) return json({ error: 'Nincs ilyen rendelés.' }, 404);
  return json(toPublic(o));
}
