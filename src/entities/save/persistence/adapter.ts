import type { LoadResult, SavePersistence } from '../model/store';
import type { Save } from '../model/schema';
import { SAVE_KEY } from './keys';
import { defaultKeyValue, hasIndexedDb, type KeyValueStore } from './kv';
import { detectVersion, migrateSave } from './migrate';
import { browserLocalStorage, readV1Doc } from './v1';

/** Coalesce bursts of updates into one write this long after the last one… */
const WRITE_DEBOUNCE_MS = 250;
/** …but never hold a pending write longer than this while updates keep coming. */
const WRITE_MAX_WAIT_MS = 2000;
/** A first IndexedDB open that hangs (seen in some Safari versions) counts as blocked storage. */
const OPEN_TIMEOUT_MS = 5000;

export const LOAD_ERROR_DAMAGED = 'Your saved progress is damaged and can’t be read.';
export const LOAD_ERROR_NEWER =
  'Your saved progress was made by a newer version. Update the page and try again.';

type Listenable = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;

export type PersistenceOptions = {
  /** Key-value store; defaults to IndexedDB `trainer-studio` / `keyval`. `null` = storage blocked. */
  kv?: KeyValueStore | null;
  /** Where the v1 roster is read from; defaults to `window.localStorage`. */
  localStorage?: Pick<Storage, 'getItem'> | null;
  now?: () => number;
  debounceMs?: number;
  maxWaitMs?: number;
  openTimeoutMs?: number;
  /** Flush the pending write on `pagehide` (window) and `visibilitychange` → hidden (document). */
  window?: Listenable | null;
  document?: (Listenable & Pick<Document, 'visibilityState'>) | null;
};

export type IdbPersistence = SavePersistence & {
  /** Write the pending save now (also runs on pagehide / tab hidden). */
  flush(): Promise<void>;
  /** Stop listening to page lifecycle events. */
  dispose(): void;
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('IndexedDB timed out')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * The save in IndexedDB (`save:v2`), with debounced writes and the v1 → v2 migration on first load.
 * When IndexedDB is missing, blocked or can't be read, the game runs in memory: `durable` is false,
 * writes resolve false and nothing stored is ever overwritten. Never throws.
 */
export function createDefaultPersistence(options: PersistenceOptions = {}): IdbPersistence {
  const kv = options.kv === undefined ? (hasIndexedDb() ? defaultKeyValue() : null) : options.kv;
  const now = options.now ?? Date.now;
  const debounceMs = options.debounceMs ?? WRITE_DEBOUNCE_MS;
  const maxWaitMs = options.maxWaitMs ?? WRITE_MAX_WAIT_MS;
  const openTimeoutMs = options.openTimeoutMs ?? OPEN_TIMEOUT_MS;
  const win =
    options.window === undefined ? (typeof window === 'undefined' ? null : window) : options.window;
  const doc =
    options.document === undefined
      ? typeof document === 'undefined'
        ? null
        : document
      : options.document;

  /** False once IndexedDB failed to open or read: from then on nothing is written. */
  let available = kv !== null;
  let lastWriteOk = true;
  let pending: { save: Save; since: number; waiters: ((ok: boolean) => void)[] } | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function flush(): Promise<void> {
    clearTimeout(timer);
    timer = undefined;
    const batch = pending;
    pending = null;
    if (!batch) return;
    let ok = false;
    if (available && kv) {
      try {
        await kv.set(SAVE_KEY, batch.save);
        ok = true;
      } catch {
        ok = false; // quota or a closed connection: the save lives in memory until a later write lands
      }
    }
    lastWriteOk = ok;
    for (const resolve of batch.waiters) resolve(ok);
  }

  function write(save: Save): Promise<boolean> {
    if (!available || !kv) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      const t = now();
      if (pending) {
        pending.save = save;
        pending.waiters.push(resolve);
      } else {
        pending = { save, since: t, waiters: [resolve] };
      }
      clearTimeout(timer);
      const wait = Math.max(0, Math.min(debounceMs, pending.since + maxWaitMs - t));
      timer = setTimeout(() => void flush(), wait);
    });
  }

  async function readStored(): Promise<LoadResult | null> {
    if (!kv || !available) return null;
    let stored: unknown;
    try {
      stored = await withTimeout(kv.get(SAVE_KEY), openTimeoutMs);
    } catch {
      available = false; // blocked, private mode or hung: play in memory, never overwrite what's there
      return null;
    }
    if (stored === undefined) return null;
    const version = detectVersion(stored);
    if (version === null) return { kind: 'error', reason: LOAD_ERROR_DAMAGED };
    const result = await migrateSave(version, stored, { now: now() });
    if (result.ok) return { kind: 'loaded', save: result.save };
    return {
      kind: 'error',
      reason: result.reason === 'newer' ? LOAD_ERROR_NEWER : LOAD_ERROR_DAMAGED,
    };
  }

  async function load(): Promise<LoadResult> {
    try {
      const stored = await readStored();
      if (stored) return stored;

      // No v2 save yet: a v1 player gets their old roster imported (the v1 keys are only read).
      const v1 = readV1Doc(
        options.localStorage === undefined ? browserLocalStorage() : options.localStorage,
      );
      if (!v1) return { kind: 'empty' };
      const result = await migrateSave(1, v1, { now: now() });
      if (!result.ok) return { kind: 'empty' };
      void write(result.save); // the store doesn't write a loaded save; keep the migration on reload
      return { kind: 'loaded', save: result.save };
    } catch {
      available = false; // unexpected: start in memory rather than risk writing over a stored save
      return { kind: 'empty' };
    }
  }

  const onPageHide = () => void flush();
  const onVisibilityChange = () => {
    if (doc?.visibilityState === 'hidden') void flush();
  };
  win?.addEventListener('pagehide', onPageHide);
  doc?.addEventListener('visibilitychange', onVisibilityChange);

  return {
    get durable() {
      return available && lastWriteOk;
    },
    load,
    write,
    flush,
    dispose() {
      win?.removeEventListener('pagehide', onPageHide);
      doc?.removeEventListener('visibilitychange', onVisibilityChange);
    },
  };
}
