import { getStatus } from '@/lib/server/content';
import { json } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

/** Nyitva/zárva, elfogyott termékek – a vásárlói oldal időnként lekéri */
export async function GET() {
  return json(await getStatus());
}
