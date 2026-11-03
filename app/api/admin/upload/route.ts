import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { put } from '@vercel/blob';
import { guard, json } from '@/lib/server/auth';

/** Képfeltöltés. A böngésző már átméretezte (WebP vagy JPEG) (nagy + kicsi változat). */
export async function POST(req: Request) {
  const deny = await guard();
  if (deny) return deny;
  const form = await req.formData().catch(() => null);
  const full = form?.get('full');
  const thumb = form?.get('thumb');
  if (!(full instanceof File) || !(thumb instanceof File)) return json({ error: 'Hiányzik a kép.' }, 400);
  if (full.size > 3_500_000 || thumb.size > 800_000) return json({ error: 'Túl nagy kép.' }, 413);

  const bufs = await Promise.all([full, thumb].map(async (f) => Buffer.from(await f.arrayBuffer())));
  // Valóban kép? A fájl elejét nézzük – a fájlnévnek és a típusnak nem hiszünk.
  const kind = (b: Buffer) =>
    b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' ? 'webp'
    : b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff ? 'jpg' : null;
  const kinds = bufs.map(kind);
  if (kinds.some((k) => !k)) return json({ error: 'Csak képet lehet feltölteni.' }, 415);
  const [extL, extS] = kinds as ('webp' | 'jpg')[];
  const type = (e: string) => (e === 'webp' ? 'image/webp' : 'image/jpeg');

  const name = randomUUID().replace(/-/g, '').slice(0, 20);
  try {
    if (process.env.BLOB_READ_WRITE_TOKEN) {
      const opts = { access: 'public' as const, addRandomSuffix: false, cacheControlMaxAge: 31536000 };
      const [a, b] = await Promise.all([
        put(`kepek/${name}-l.${extL}`, bufs[0], { ...opts, contentType: type(extL) }),
        put(`kepek/${name}-s.${extS}`, bufs[1], { ...opts, contentType: type(extS) }),
      ]);
      return json({ src: a.url, thumb: b.url });
    }
    const dir = process.env.VERCEL ? '/tmp/zolgiz/uploads' : path.join(process.cwd(), '.data', 'uploads');
    await fs.mkdir(dir, { recursive: true });
    await Promise.all([fs.writeFile(path.join(dir, `${name}-l.${extL}`), bufs[0]), fs.writeFile(path.join(dir, `${name}-s.${extS}`), bufs[1])]);
    return json({ src: `/api/media/${name}-l.${extL}`, thumb: `/api/media/${name}-s.${extS}`, temporary: !!process.env.VERCEL });
  } catch (e) {
    console.error('upload', e);
    return json({ error: 'A feltöltés nem sikerült.' }, 500);
  }
}
