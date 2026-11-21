import { useSyncExternalStore } from 'react';

export type Route = '/' | '/battle';

export type HashParams = Record<string, string>;

/** The route and the `?query` that follows it, e.g. `#/battle?red=<id>`. Anything unknown is home. */
export function parseLocation(hash: string): { route: Route; params: URLSearchParams } {
  const q = hash.indexOf('?');
  const path = q === -1 ? hash : hash.slice(0, q);
  const query = q === -1 ? '' : hash.slice(q + 1);
  return { route: path === '#/battle' ? '/battle' : '/', params: new URLSearchParams(query) };
}

/** Anything but a known `#/route` is home. */
export function parseHash(hash: string): Route {
  return parseLocation(hash).route;
}

/** The `href` for a plain `<a>` pointing at a route (optionally with query params). */
export const href = (route: Route, params?: HashParams): string => {
  const query = params ? new URLSearchParams(params).toString() : '';
  return `#${route}${query ? `?${query}` : ''}`;
};

export function navigate(route: Route, params?: HashParams): void {
  window.location.hash = href(route, params);
}

/** One query param of the current hash (`null` outside the browser or when absent). */
export function currentHashParam(name: string): string | null {
  if (typeof window === 'undefined') return null;
  return parseLocation(window.location.hash).params.get(name);
}

function subscribe(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

/** The current route, re-rendering on `hashchange` (back/forward included). */
export function useHashRoute(): Route {
  return useSyncExternalStore(
    subscribe,
    () => parseHash(window.location.hash),
    () => '/',
  );
}
