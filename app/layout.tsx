import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from 'next/font/google';
import { QueryProvider } from '@/app/providers/QueryProvider';
import { SaveProvider } from '@/app/providers/SaveProvider';
import { AppNav } from '@/widgets/app-nav';
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
  title: { default: 'Trainer Studio', template: '%s · Trainer Studio' },
  description:
    'A free collection auto-battler in your browser: open capsules, level up your team and watch it fight in 3D. Unofficial fan project.',
  openGraph: {
    title: 'Trainer Studio',
    description: 'Open capsules, level up your team and watch your collection fight in 3D.',
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
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:bg-primary focus:px-4 focus:py-3 focus:text-primary-foreground"
        >
          Skip to content
        </a>
        <QueryProvider>
          <SaveProvider>
            <AppNav />
            {children}
          </SaveProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
