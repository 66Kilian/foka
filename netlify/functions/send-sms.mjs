// Automatikus SMS küldés a konyhai felületről (CONFIG.smsMode = 'twilio').
// Netlify → Site settings → Environment variables:
//   FIREBASE_API_KEY  – ugyanaz, mint a js/config.js-ben
//   STAFF_EMAILS      – vesszővel elválasztva, pl. "konyha@zolgiz.hu,zoli@zolgiz.hu"
//   TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM  – a Twilio fiókból (TWILIO_FROM pl. +36… vagy alfanumerikus feladó)

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const { FIREBASE_API_KEY, STAFF_EMAILS = '', TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM } = process.env;
  if (!FIREBASE_API_KEY || !TWILIO_SID || !TWILIO_TOKEN || !TWILIO_FROM) return json({ error: 'not-configured' }, 500);

  // 1) Csak bejelentkezett konyhai dolgozó küldhet
  const idToken = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!idToken) return json({ error: 'unauthorized' }, 401);
  const look = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });
  if (!look.ok) return json({ error: 'unauthorized' }, 401);
  const user = (await look.json()).users?.[0];
  const allowed = STAFF_EMAILS.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (!user?.email || !allowed.includes(user.email.toLowerCase())) return json({ error: 'forbidden' }, 403);

  // 2) Bemenet ellenőrzése
  let body;
  try { body = await req.json(); } catch { return json({ error: 'bad-json' }, 400); }
  const { to, text } = body || {};
  if (typeof to !== 'string' || !/^\+36\d{9}$/.test(to)) return json({ error: 'bad-phone' }, 400);
  if (typeof text !== 'string' || !text.trim() || text.length > 320) return json({ error: 'bad-text' }, 400);

  // 3) Küldés
  const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: TWILIO_FROM, Body: text }),
  });
  if (!r.ok) {
    console.error('Twilio', r.status, await r.text());
    return json({ error: 'provider' }, 502);
  }
  return json({ ok: true });
};
