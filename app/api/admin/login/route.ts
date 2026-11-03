import { z } from 'zod';
import { adminPassword, checkPassword, clientIp, json, sameOrigin, startSession } from '@/lib/server/auth';
import { db } from '@/lib/server/db';

export async function POST(req: Request) {
  if (!(await sameOrigin())) return json({ error: 'Tiltott kérés.' }, 403);
  if (!adminPassword()) return json({ error: 'Nincs beállítva admin jelszó. Vercel → Settings → Environment Variables → ADMIN_PASSWORD.' }, 503);
  const key = `rl:login:${await clientIp()}`;
  if (((await db.get<number>(key)) ?? 0) >= 10) return json({ error: 'Túl sok próbálkozás. Várj 15 percet.' }, 429);
  const body = z.object({ password: z.string().max(200) }).safeParse(await req.json().catch(() => null));
  if (!body.success || !checkPassword(body.data.password)) {
    await db.incr(key, 900);
    return json({ error: 'Hibás jelszó.' }, 401);
  }
  await startSession();
  return json({ ok: true });
}
