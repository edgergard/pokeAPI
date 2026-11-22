import { createStore, get, set, setMany, type UseStore } from 'idb-keyval';
import { DB_NAME, STORE_NAME } from './keys';

/** The IndexedDB calls the save needs. All reject when IndexedDB is missing, blocked or full. */
export interface KeyValueStore {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  /** Writes every entry in one transaction: all of them land or none does. */
  setMany(entries: [string, unknown][]): Promise<void>;
}

/**
 * idb-keyval over the `trainer-studio` / `keyval` store. The database opens lazily on the first call;
 * a missing `indexedDB` global throws synchronously inside idb-keyval, so every call is wrapped to reject.
 */
export function createIdbKeyValue(store?: UseStore): KeyValueStore {
  let resolved = store;
  const idbStore = (): UseStore => (resolved ??= createStore(DB_NAME, STORE_NAME));
  return {
    async get(key) {
      return get(key, idbStore());
    },
    async set(key, value) {
      await set(key, value, idbStore());
    },
    async setMany(entries) {
      await setMany(entries, idbStore());
    },
  };
}

let shared: KeyValueStore | null = null;

/** One store per page, shared by the save adapter and the backup slot. */
export function defaultKeyValue(): KeyValueStore {
  return (shared ??= createIdbKeyValue());
}

/** Whether this environment exposes IndexedDB at all (accessing it can throw in sandboxed frames). */
export function hasIndexedDb(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}
