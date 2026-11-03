import { promises as fs } from 'node:fs';
import path from 'node:path';

/** Helyi fejlesztésnél feltöltött képek (Vercelen a Blob tárhely szolgálja ki őket) */
export async function GET(_req: Request, ctx: { params: Promise<{ file: string }> }) {
  const { file } = await ctx.params;
  if (!/^[\w-]+\.(webp|jpg)$/.test(file)) return new Response('Not found', { status: 404 });
  const dir = process.env.VERCEL ? '/tmp/zolgiz/uploads' : path.join(process.cwd(), '.data', 'uploads');
  try {
    const buf = await fs.readFile(path.join(dir, file));
    return new Response(new Uint8Array(buf), { headers: { 'Content-Type': file.endsWith('.jpg') ? 'image/jpeg' : 'image/webp', 'Cache-Control': 'public, max-age=31536000, immutable' } });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
