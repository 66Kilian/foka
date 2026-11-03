import type { MetadataRoute } from 'next';
import { getContent } from '@/lib/server/content';

export const dynamic = 'force-dynamic';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const c = await getContent();
  const base = process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000');
  return [{ url: `${base}/`, lastModified: c.updatedAt ? new Date(c.updatedAt) : new Date(), changeFrequency: 'daily', priority: 1 }];
}
