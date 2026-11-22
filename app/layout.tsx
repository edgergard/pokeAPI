import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from 'next/font/google';
import { QueryProvider } from '@/app/providers/QueryProvider';
import { motionScript } from '@/app/motionScript';
import { SITE_URL } from '@/shared/config/site';
import '@/app/styles.css';

// Fonts are downloaded at build time and served from the site itself: no render-blocking request
// to Google, no layout shift (size-adjusted fallbacks), and only the subsets actually used.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const bricolage = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-bricolage',
  axes: ['opsz'],
  display: 'swap',
});
const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '700'],
  variable: '--font-jetbrains',
  display: 'swap',
  // Only used for small labels: not worth a preload on every page.
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Trainer Studio · PokeAPI', template: '%s · Trainer Studio' },
  description:
    'Build your Pokémon team of four and watch two teams battle as 3D cards — powered by PokeAPI.',
  openGraph: {
    title: 'Trainer Studio · PokeAPI',
    description: 'Build your Pokémon team of four and watch two teams battle as 3D cards.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  themeColor: '#0b0c10',
  colorScheme: 'dark',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // data-motion is set by the inline script before hydration, hence suppressHydrationWarning.
    <html
      lang="en"
      data-motion="full"
      suppressHydrationWarning
      className={`${inter.variable} ${bricolage.variable} ${jetbrains.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: motionScript }} />
        <link rel="preconnect" href="https://pokeapi.co" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://raw.githubusercontent.com" />
      </head>
      <body>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
