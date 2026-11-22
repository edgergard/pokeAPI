import { useSyncExternalStore } from 'react';

type Options<T> = {
  /** Reads the value from browser storage. Called lazily, once, on the client. Must not throw. */
  read: () => T;
  /** Persists a new value; returns false when storage refused it (full or blocked). Must not throw. */
  write: (value: T) => boolean;
  /** What prerendered HTML (and the hydrating render) shows. Must be a stable reference. */
  serverValue: T;
  /** Storage key to watch for changes made in other tabs (`storage` event). */
  syncKey?: string;
};

export type StorageStore<T> = {
  get: () => T;
  set: (update: T | ((current: T) => T)) => void;
  subscribe: (onChange: () => void) => () => void;
  /** Reactive value: `serverValue` while hydrating, then the stored value — no hydration mismatch. */
  useValue: () => T;
};

/**
 * A tiny external store over Web Storage for statically prerendered pages.
 * Reading storage inside `useState` would make the first client render differ from the server HTML;
 * `useSyncExternalStore` hydrates with `serverValue` and swaps in the stored value before paint.
 */
export function createStorageStore<T>({
  read,
  write,
  serverValue,
  syncKey,
}: Options<T>): StorageStore<T> {
  let value: T | undefined;
  let loaded = false;
  /** The last write never reached storage: memory is the only copy, so storage must not be re-read over it. */
  let dirty = false;
  const listeners = new Set<() => void>();

  const get = (): T => {
    if (typeof window === 'undefined') return serverValue;
    if (!loaded) {
      value = read();
      loaded = true;
    }
    return value as T;
  };

  const emit = () => listeners.forEach((listener) => listener());

  const onStorage = (event: StorageEvent) => {
    if (event.key !== syncKey && event.key !== null) return;
    if (dirty) return; // keep the in-memory value storage never got
    value = read();
    emit();
  };

  const subscribe = (onChange: () => void) => {
    if (listeners.size === 0 && typeof window !== 'undefined') {
      // Nobody was listening, so storage events (other tabs) may have been missed: refresh the cache before
      // a remounted component can build a write on stale data. useSyncExternalStore re-checks the snapshot
      // after subscribing, so the fresh value renders.
      if (loaded && !dirty) value = read();
      if (syncKey) window.addEventListener('storage', onStorage);
    }
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
      if (listeners.size === 0 && syncKey && typeof window !== 'undefined') {
        window.removeEventListener('storage', onStorage);
      }
    };
  };

  const set: StorageStore<T>['set'] = (update) => {
    const current = get();
    const next = typeof update === 'function' ? (update as (current: T) => T)(current) : update;
    if (Object.is(next, current)) return;
    value = next;
    dirty = !write(next);
    emit();
  };

  return {
    get,
    set,
    subscribe,
    useValue: () => useSyncExternalStore(subscribe, get, () => serverValue),
  };
}
