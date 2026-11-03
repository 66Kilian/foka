import type { Metadata } from 'next';
import { SiteView } from '@/components/site/SiteView';
import { getContent, getStatus } from '@/lib/server/content';
import { heroSlides } from '@/lib/menu';

// Mindig a legfrissebb (az adminban közzétett) tartalom
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const c = await getContent();
  const img = heroSlides(c)[0]?.image?.src;
  return {
    title: c.seo.title,
    description: c.seo.description,
    alternates: { canonical: '/' },
    openGraph: { type: 'website', title: `${c.brand.name} – ${c.contact.town}`, description: c.seo.description, locale: 'hu_HU', images: img ? [img] : undefined },
  };
}

export default async function Home() {
  const [c, s] = await Promise.all([getContent(), getStatus()]);
  const [street, ...rest] = c.contact.address.split(',').reverse();
  const zipTown = rest.reverse().join(',').trim();
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    name: c.brand.name,
    servesCuisine: ['Pizza', 'Hamburger', 'Gyros'],
    telephone: c.contact.phone.replace(/[^\d+]/g, ''),
    address: { '@type': 'PostalAddress', streetAddress: street?.trim(), postalCode: zipTown.match(/\d{4}/)?.[0], addressLocality: c.contact.town, addressCountry: 'HU' },
    geo: { '@type': 'GeoCoordinates', latitude: c.contact.lat, longitude: c.contact.lng },
    ...(c.contact.facebook ? { sameAs: [c.contact.facebook] } : {}),
    hasMenu: {
      '@type': 'Menu',
      hasMenuSection: c.categories.map((cat) => ({
        '@type': 'MenuSection',
        name: cat.title,
        hasMenuItem: c.items.filter((i) => i.category === cat.id && !i.hidden).map((i) => ({
          '@type': 'MenuItem', name: i.name, description: i.desc, offers: { '@type': 'Offer', price: i.price, priceCurrency: 'HUF' },
        })),
      })),
    },
  };
  return (
    <>
      {/* JSON-LD: a < jelet escape-eljük, így a tartalomból nem lehet kitörni a script tagből */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
      <SiteView content={c} status={s} />
    </>
  );
}
