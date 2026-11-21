export type Route = '/' | '/battle';

export type RouteParams = Record<string, string>;

/**
 * The `href` for a route (optionally with query params), e.g. `/battle/?red=<id>`.
 * Pass it to next/link, which prefixes the deploy basePath. Trailing slashes match `trailingSlash: true`,
 * so links hit the exported `battle/index.html` directly instead of a redirect.
 */
export const href = (route: Route, params?: RouteParams): string => {
  const query = params ? new URLSearchParams(params).toString() : '';
  const path = route === '/' ? '/' : `${route}/`;
  return `${path}${query ? `?${query}` : ''}`;
};

/**
 * Old builds used hash routing (`#/battle?red=<id>`), and those links live on in bookmarks and posts.
 * Returns the path-based `href` a legacy hash points at, or `null` when it isn't a legacy route link.
 */
export function legacyHashTarget(hash: string): string | null {
  if (!hash.startsWith('#/')) return null;
  const q = hash.indexOf('?');
  const path = q === -1 ? hash.slice(1) : hash.slice(1, q);
  const params = new URLSearchParams(q === -1 ? '' : hash.slice(q + 1));
  if (path === '/battle' || path === '/battle/') {
    const entries = Object.fromEntries(params);
    return href('/battle', Object.keys(entries).length ? entries : undefined);
  }
  return path === '/' ? href('/') : null;
}
