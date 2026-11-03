import { guard, json } from '@/lib/server/auth';
import { setStatus } from '@/lib/server/content';
import { StatusPatch, issues } from '@/lib/server/schema';

export async function PATCH(req: Request) {
  const deny = await guard();
  if (deny) return deny;
  const p = StatusPatch.safeParse(await req.json().catch(() => null));
  if (!p.success) return json({ error: issues(p.error) }, 400);
  return json(await setStatus(p.data));
}
