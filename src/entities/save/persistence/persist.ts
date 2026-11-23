import { useSyncExternalStore } from 'react';

/**
 * Persistent storage (`navigator.storage.persist()`): asks the browser not to evict the save under
 * storage pressure. Requested once per page load (stream 2-home asks after onboarding); Settings shows it.
 *
 * - `unknown`: not checked yet (prerender, first client render)
 * - `persisted`: granted (now or in an earlier visit)
 * - `not-persisted`: not granted and not asked in this page load
 * - `denied`: `requestPersist()` resolved false
 * - `unsupported`: no StorageManager in this browser
 */
export type PersistState = 'unknown' | 'persisted' | 'not-persisted' | 'denied' | 'unsupported';

let state: PersistState = 'unknown';
let request: Promise<boolean> | null = null;
let checking: Promise<void> | null = null;
const listeners = new Set<() => void>();

function setState(next: PersistState) {
  if (next === state) return;
  state = next;
  for (const listener of listeners) listener();
}

function storageManager(): StorageManager | null {
  try {
    return typeof navigator !== 'undefined' && navigator.storage ? navigator.storage : null;
  } catch {
    return null;
  }
}

/**
 * Calls `navigator.storage.persist()` once; later calls return the same promise. Resolves true when
 * storage is persistent, false when denied or unsupported. Never rejects.
 */
export function requestPersist(): Promise<boolean> {
  request ??= (async () => {
    const storage = storageManager();
    if (!storage || typeof storage.persist !== 'function') {
      setState('unsupported');
      return false;
    }
    try {
      const granted = await storage.persist();
      setState(granted ? 'persisted' : 'denied');
      return granted;
    } catch {
      setState('denied');
      return false;
    }
  })();
  return request;
}

/** Re-reads `navigator.storage.persisted()`, combined with the result of this page's request (if any). */
function check(): Promise<void> {
  checking ??= (async () => {
    const storage = storageManager();
    if (!storage || typeof storage.persisted !== 'function') {
      setState('unsupported');
      return;
    }
    let persisted = false;
    try {
      persisted = await storage.persisted();
    } catch {
      persisted = false;
    }
    if (persisted) setState('persisted');
    else if (request) setState((await request) ? 'persisted' : 'denied');
    else setState('not-persisted');
  })().finally(() => {
    checking = null;
  });
  return checking;
}

function subscribe(listener: () => void): () => void {
  if (listeners.size === 0) void check();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The persistent-storage state for status lines and banners (`unknown` until checked on the client). */
export function usePersistState(): PersistState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => 'unknown',
  );
}

/** The persistent-storage state, freshly read (for non-React callers; components use the hook). */
export async function readPersistState(): Promise<PersistState> {
  await check();
  return state;
}

/** Test helper: forget the cached request and state. */
export function __resetPersistForTests(): void {
  state = 'unknown';
  request = null;
  checking = null;
  listeners.clear();
}
