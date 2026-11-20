import { useSyncExternalStore } from 'react';

export type Route = '/' | '/battle';

/** Anything but a known `#/route` is home. */
export function parseHash(hash: string): Route {
  return hash === '#/battle' ? '/battle' : '/';
}

/** The `href` for a plain `<a>` pointing at a route. */
export const href = (route: Route): string => `#${route}`;

export function navigate(route: Route): void {
  window.location.hash = href(route);
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
