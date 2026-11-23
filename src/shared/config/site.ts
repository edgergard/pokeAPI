/**
 * Where the site lives. Vercel is the only production host (GitHub Pages was retired on 2026-11-23), and the
 * site is always served from the domain root — no basePath.
 */
const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;

/**
 * Absolute site URL with a trailing slash — the base for canonical / Open Graph / sitemap URLs.
 * Vercel builds use the project's production domain; local builds use the dev server.
 */
export const SITE_URL = vercelHost ? `https://${vercelHost}/` : 'http://localhost:3000/';

/** The Open Graph card (app/opengraph-image.png/route.tsx), relative to SITE_URL. */
export const OG_IMAGE = {
  url: 'opengraph-image.png',
  width: 1200,
  height: 630,
  alt: 'Trainer Studio: collect, level up and auto-battle in your browser',
} as const;
