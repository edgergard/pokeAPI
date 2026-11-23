import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/shared/config/site';

// Static export: prerender robots.txt at build time.
export const dynamic = 'force-static';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/' },
    sitemap: `${SITE_URL}sitemap.xml`,
  };
}
