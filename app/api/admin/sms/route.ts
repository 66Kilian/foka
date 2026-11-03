import { z } from 'zod';
import { guard, json } from '@/lib/server/auth';

/** Automatikus SMS (Beállítások → SMS mód: Twilio). Kell: TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM. */
export async function POST(req: Request) {
  const deny = await guard();
  if (deny) return deny;
  const { TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM } = process.env;
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) return json({ error: 'A Twilio nincs beállítva (TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM).' }, 503);
  const b = z.object({ to: z.string().regex(/^\+36\d{9}$/), text: z.string().trim().min(1).max(320) }).safeParse(await req.json().catch(() => null));
  if (!b.success) return json({ error: 'Hibás telefonszám vagy üzenet.' }, 400);
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: b.data.to, From: TWILIO_FROM, Body: b.data.text }),
  });
  if (!r.ok) {
    console.error('Twilio', r.status, await r.text());
    return json({ error: 'Az SMS szolgáltató hibát jelzett.' }, 502);
  }
  return json({ ok: true });
}
