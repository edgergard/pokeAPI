import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Fully static site: every route is prerendered to HTML at build time and served from Pages' CDN.
  output: 'export',
  // /battle → /battle/index.html, which Pages can serve without rewrites.
  trailingSlash: true,
  // Pages has no image optimizer; Pokémon sprites are tiny pixel art served by GitHub's CDN anyway.
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Per-icon imports instead of the whole barrel.
    optimizePackageImports: ['lucide-react'],
  },
};

export default nextConfig;
