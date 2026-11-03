import { revalidatePath } from 'next/cache';
import { guard, json } from '@/lib/server/auth';
import { getContent, saveContent } from '@/lib/server/content';
import { ContentSchema, issues } from '@/lib/server/schema';
import type { Content } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const deny = await guard(false);
  if (deny) return deny;
  return json(await getContent());
}

/** Közzététel. baseUpdatedAt: ha közben valaki más mentett, nem írjuk felül csendben. */
export async function PUT(req: Request) {
  const deny = await guard();
  if (deny) return deny;
  const body = (await req.json().catch(() => null)) as { content?: unknown; baseUpdatedAt?: number; force?: boolean } | null;
  const parsed = ContentSchema.safeParse(body?.content);
  if (!parsed.success) return json({ error: 'Hibás adat: ' + issues(parsed.error) }, 400);
  const current = await getContent();
  if (!body?.force && body?.baseUpdatedAt !== undefined && current.updatedAt !== body.baseUpdatedAt) {
    return json({ error: 'Közben máshonnan is mentettek. Töltsd újra az oldalt, vagy írd felül.', conflict: true, current }, 409);
  }
  const saved = await saveContent(parsed.data as Content);
  revalidatePath('/');
  return json(saved);
}
