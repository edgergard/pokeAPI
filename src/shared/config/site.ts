/**
 * Where the site is deployed. Read at build time (the export is static).
 * - Vercel (`VERCEL=1`): served at the domain root; the canonical URL is the project's production domain.
 * - GitHub Pages (any other production build): served under /trainer-studio/.
 * - `next dev`: the root.
 */
const onVercel = Boolean(process.env.VERCEL);

export const BASE_PATH =
  process.env.NODE_ENV === 'production' && !onVercel ? '/trainer-studio' : '';

const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;

/** Absolute site URL with a trailing slash — the base for canonical / Open Graph URLs. */
export const SITE_URL =
  onVercel && vercelHost ? `https://${vercelHost}/` : 'https://edgergard.github.io/trainer-studio/';
