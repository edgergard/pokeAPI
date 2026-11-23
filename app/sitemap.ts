import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/shared/config/site';

// Static export: prerender sitemap.xml at build time.
export const dynamic = 'force-static';

/**
 * Every page that has one canonical URL. /battle/ and /creature/ are left out: they render from query
 * params (?stage=, ?id=) and have no content of their own without them.
 */
const PATHS = [
  '',
  'ladder/',
  'collection/',
  'capsules/',
  'trainer/',
  'settings/',
  'privacy/',
  'terms/',
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  // SITE_URL ends with a slash and already includes the GitHub Pages basePath.
  return PATHS.map((path) => ({ url: `${SITE_URL}${path}` }));
}
