import { z } from 'zod';
import { guard, json } from '@/lib/server/auth';
import { getContent } from '@/lib/server/content';
import { estimateDelivery } from '@/lib/server/eta';

export async function POST(req: Request) {
  const deny = await guard();
  if (deny) return deny;
  const b = z.object({ town: z.string().max(60), street: z.string().max(120) }).safeParse(await req.json().catch(() => null));
  if (!b.success) return json({ ok: false, reason: 'notfound' }, 400);
  return json(await estimateDelivery(b.data.town, b.data.street, await getContent()));
}
