import { endSession, json, sameOrigin } from '@/lib/server/auth';

export async function POST() {
  if (!(await sameOrigin())) return json({ error: 'Tiltott kérés.' }, 403);
  await endSession();
  return json({ ok: true });
}
