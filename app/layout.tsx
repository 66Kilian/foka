import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Figtree } from 'next/font/google';
import { IconSprite } from '@/components/Icon';
import './styles/site.css';
import './styles/admin.css';
import './styles/editor.css';

const display = Bricolage_Grotesque({ subsets: ['latin', 'latin-ext'], weight: ['500', '600', '700', '800'], variable: '--font-display', display: 'swap' });
const body = Figtree({ subsets: ['latin', 'latin-ext'], weight: ['400', '500', '600', '700', '800'], variable: '--font-body', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:3000')),
  icons: { icon: '/icon.svg' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#c8281b' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hu" className={`${display.variable} ${body.variable}`}>
      <body>
        <IconSprite />
        {children}
      </body>
    </html>
  );
}
