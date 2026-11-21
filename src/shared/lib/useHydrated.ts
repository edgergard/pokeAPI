import { useSyncExternalStore } from 'react';

const noopSubscribe = () => () => {};

/**
 * False in prerendered HTML and during the hydrating render, true afterwards — and true right away for
 * components first mounted by client-side navigation. Use it to hold back UI that depends on browser-only
 * state (storage, the query string) instead of rendering a wrong guess that swaps after hydration.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
