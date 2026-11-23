import type { LoadResult, SavePersistence } from '../model/store';
import type { Save } from '../model/schema';
import type { SaveBackup } from './backup';
import { reportSaveConflict } from './conflict';
import { BACKUP_KEY, SAVE_KEY, SESSION_SAVE_KEY } from './keys';
import { defaultKeyValue, hasIndexedDb, type KeyValueStore } from './kv';
import { detectVersion, migrateSave } from './migrate';
import { browserLocalStorage, readV1Doc } from './v1';

/** Coalesce bursts of updates into one write this long after the last one… */
const WRITE_DEBOUNCE_MS = 250;
/** …but never hold a pending write longer than this while updates keep coming. */
const WRITE_MAX_WAIT_MS = 2000;
/** A first IndexedDB open that hangs (seen in some Safari versions) counts as blocked storage. */
const OPEN_TIMEOUT_MS = 5000;
/** Tabs of the same browser tell each other about every save they write. */
const SYNC_CHANNEL = 'trainer-studio-save';

export const LOAD_ERROR_DAMAGED = 'Your saved progress is damaged and can’t be read.';
export const LOAD_ERROR_NEWER =
  'Your saved progress was made by a newer version. Update the page and try again.';
export const LOAD_ERROR_UNAVAILABLE =
  'Couldn’t load the game files needed to read your save. Check your connection and reload the page.';

type SessionStore = Pick<Storage, 'getItem' | 'setItem'>;

/** `window.sessionStorage`, or null when there is none or touching it throws (sandboxed frames). */
function browserSessionStorage(): SessionStore | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

type Listenable = Pick<EventTarget, 'addEventListener' | 'removeEventListener'>;

export type PersistenceOptions = {
  /** Key-value store; defaults to IndexedDB `trainer-studio` / `keyval`. `null` = storage blocked. */
  kv?: KeyValueStore | null;
  /** Where the v1 roster is read from; defaults to `window.localStorage`. */
  localStorage?: Pick<Storage, 'getItem'> | null;
  /** Same-tab fallback while IndexedDB is missing or blocked; defaults to `window.sessionStorage`. */
  sessionStorage?: SessionStore | null;
  now?: () => number;
  debounceMs?: number;
  maxWaitMs?: number;
  openTimeoutMs?: number;
  /** Flush the pending write on `pagehide` (window) and `visibilitychange` → hidden (document). */
  window?: Listenable | null;
  document?: (Listenable & Pick<Document, 'visibilityState'>) | null;
  /** BroadcastChannel name for the cross-tab guard; `null` turns the guard off. */
  channel?: string | null;
};

export type IdbPersistence = SavePersistence & {
  /** Write the pending save now (also runs on pagehide / tab hidden). */
  flush(): Promise<void>;
  /**
   * Write `save` (and, when given, the backup slot) in one transaction, replacing any pending write.
   * Resolves false — and stores nothing — when it can't.
   */
  commit(save: Save, backup: SaveBackup | null): Promise<boolean>;
  /** Stop listening to page lifecycle events and other tabs. */
  dispose(): void;
};

/** "Tab `tab` stored a save at `at` (ms)". */
type SyncMessage = { type: 'saved'; tab: string; at: number };

const isSyncMessage = (value: unknown): value is SyncMessage =>
  typeof value === 'object' &&
  value !== null &&
  'type' in value &&
  value.type === 'saved' &&
  'tab' in value &&
  typeof value.tab === 'string' &&
  'at' in value &&
  typeof value.at === 'number';

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('IndexedDB timed out')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function randomTabId(): string {
  const bytes = new Uint32Array(2);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (n) => n.toString(36)).join('');
}

function openChannel(name: string | null): BroadcastChannel | null {
  if (!name || typeof BroadcastChannel === 'undefined') return null;
  try {
    return new BroadcastChannel(name);
  } catch {
    return null;
  }
}

const commitEntries = (save: Save, backup: SaveBackup | null): [string, unknown][] =>
  backup
    ? [
        [SAVE_KEY, save],
        [BACKUP_KEY, backup],
      ]
    : [[SAVE_KEY, save]];

/** The adapter this page loaded the save with (see `commitSave`). */
let active: IdbPersistence | null = null;

/**
 * The save in IndexedDB (`save:v2`), with debounced writes and the v1 → v2 migration on first load.
 * When IndexedDB is missing, blocked or can't be read, the save falls back to sessionStorage
 * (`SESSION_SAVE_KEY`, same document and load checks) so a full page load in the same tab keeps it;
 * `durable` stays false, IndexedDB is never written and nothing stored there is ever overwritten.
 * Without sessionStorage either, the game runs in memory and writes resolve false. A save made by a newer version is never
 * overwritten either. When another tab writes newer progress, this tab stops writing. Never throws.
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
  const channel = openChannel(options.channel === undefined ? SYNC_CHANNEL : options.channel);
  const tabId = randomTabId();
  const sessionOption =
    options.sessionStorage === undefined ? browserSessionStorage() : options.sessionStorage;

  /** False once IndexedDB failed to open or read, or holds a newer save: from then on nothing is written. */
  let available = kv !== null;
  /** The same-tab fallback, set only while IndexedDB is missing or blocked. */
  let session: SessionStore | null = kv === null ? sessionOption : null;
  let lastWriteOk = true;
  /** Another tab stored newer progress: this tab's save is stale and must not be written. */
  let superseded = false;
  /** When this tab last read or wrote `save:v2` (ms). */
  let lastSyncAt = Number.NEGATIVE_INFINITY;
  let pending: { save: Save; since: number; waiters: ((ok: boolean) => void)[] } | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const idbWritable = () => available && kv !== null && !superseded;
  const canWrite = () => idbWritable() || (session !== null && !superseded);

  function schedule() {
    if (!pending) return;
    clearTimeout(timer);
    const t = now();
    const wait = Math.max(0, Math.min(debounceMs, pending.since + maxWaitMs - t));
    timer = setTimeout(() => void flush(), wait);
  }

  function takePending() {
    clearTimeout(timer);
    timer = undefined;
    const batch = pending;
    pending = null;
    return batch;
  }

  function stored() {
    lastSyncAt = now();
    if (superseded) return; // our write was already stale: let the newer tab keep the lead
    channel?.postMessage({ type: 'saved', tab: tabId, at: lastSyncAt } satisfies SyncMessage);
  }

  function supersede() {
    if (superseded) return;
    superseded = true;
    const batch = takePending();
    for (const resolve of batch?.waiters ?? []) resolve(false);
    reportSaveConflict();
  }

  if (channel) {
    channel.onmessage = (event: MessageEvent) => {
      const message: unknown = event.data;
      if (!isSyncMessage(message) || message.tab === tabId) return;
      // A save stored after our last read or write makes ours stale (ties broken by tab id).
      if (message.at > lastSyncAt || (message.at === lastSyncAt && message.tab > tabId))
        supersede();
    };
  }

  async function flush(): Promise<void> {
    const batch = takePending();
    if (!batch) return;
    let ok = false;
    if (idbWritable() && kv) {
      try {
        await kv.set(SAVE_KEY, batch.save);
        ok = true;
        stored();
      } catch {
        ok = false; // quota or a closed connection: the save lives in memory until a later write lands
      }
      lastWriteOk = ok;
    } else if (session && !superseded) {
      try {
        session.setItem(SESSION_SAVE_KEY, JSON.stringify(batch.save));
        ok = true; // this tab only: durable stays false
      } catch {
        ok = false; // quota: the save lives in memory until a later write lands
      }
    }
    for (const resolve of batch.waiters) resolve(ok);
  }

  function write(save: Save): Promise<boolean> {
    if (!canWrite()) return Promise.resolve(false);
    return new Promise<boolean>((resolve) => {
      if (pending) {
        pending.save = save;
        pending.waiters.push(resolve);
      } else {
        pending = { save, since: now(), waiters: [resolve] };
      }
      schedule();
    });
  }

  async function commit(save: Save, backup: SaveBackup | null): Promise<boolean> {
    // A replacement stores the backup slot in the same transaction: IndexedDB only, never the fallback.
    if (!idbWritable() || !kv) return false;
    // Cancel the debounced write first: it holds older data and must not land after this one.
    const batch = takePending();
    let ok = false;
    try {
      await kv.setMany(commitEntries(save, backup));
      ok = true;
      stored();
    } catch {
      ok = false;
    }
    lastWriteOk = ok;
    if (ok) {
      for (const resolve of batch?.waiters ?? []) resolve(true); // superseded by what was just stored
    } else if (batch) {
      // Nothing was stored: put the cancelled write back (a newer pending one, if any, still wins).
      if (pending) pending.waiters.unshift(...batch.waiters);
      else pending = batch;
      schedule();
    }
    return ok;
  }

  /** Version check and migration of a stored document; `block` stops writes to where it came from. */
  async function checkStored(raw: unknown, block: () => void): Promise<LoadResult> {
    const version = detectVersion(raw);
    if (version === null) return { kind: 'error', reason: LOAD_ERROR_DAMAGED };
    const result = await migrateSave(version, raw, { now: now() });
    if (result.ok) return { kind: 'loaded', save: result.save };
    if (result.reason === 'newer') {
      block(); // an older game must never overwrite a newer game's save
      return { kind: 'error', reason: LOAD_ERROR_NEWER };
    }
    if (result.reason === 'unavailable') {
      block(); // the save may be fine: keep it untouched until a reload can read it
      return { kind: 'error', reason: LOAD_ERROR_UNAVAILABLE };
    }
    return { kind: 'error', reason: LOAD_ERROR_DAMAGED };
  }

  /** The sessionStorage fallback's document, through the same checks as IndexedDB's. */
  async function readSession(): Promise<LoadResult | null> {
    if (!session) return null;
    let text: string | null;
    try {
      text = session.getItem(SESSION_SAVE_KEY);
    } catch {
      session = null; // blocked too: play in memory
      return null;
    }
    if (text === null) return null;
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return { kind: 'error', reason: LOAD_ERROR_DAMAGED };
    }
    return checkStored(raw, () => {
      session = null;
    });
  }

  async function readStored(): Promise<LoadResult | null> {
    if (!kv || !available) return readSession();
    let raw: unknown;
    try {
      raw = await withTimeout(kv.get(SAVE_KEY), openTimeoutMs);
    } catch {
      // Blocked, private mode or hung: never overwrite what's there; keep this tab's progress in session.
      available = false;
      session = sessionOption;
      return readSession();
    }
    lastSyncAt = now();
    if (raw === undefined) return null;
    return checkStored(raw, () => {
      available = false;
    });
  }

  async function load(): Promise<LoadResult> {
    try {
      const fromStore = await readStored();
      if (fromStore) return fromStore;

      // No v2 save yet: a v1 player gets their old roster imported (the v1 keys are only read).
      const v1 = readV1Doc(
        options.localStorage === undefined ? browserLocalStorage() : options.localStorage,
      );
      if (!v1) return { kind: 'empty' };
      const result = await migrateSave(1, v1, { now: now() });
      if (!result.ok) {
        // Nothing to import: a normal fresh start. Otherwise the import couldn't run right now (e.g. the
        // migration code failed to load): play in memory and leave save:v2 unwritten so the next load retries.
        if (result.reason !== 'empty') {
          available = false;
          session = null; // nor the session fallback: a fresh save there would hide the v1 import
        }
        return { kind: 'empty' };
      }
      void write(result.save); // the store doesn't write a loaded save; keep the migration on reload
      return { kind: 'loaded', save: result.save };
    } catch {
      available = false; // unexpected: start in memory rather than risk writing over a stored save
      session = null;
      return { kind: 'empty' };
    }
  }

  const onPageHide = () => void flush();
  const onVisibilityChange = () => {
    if (doc?.visibilityState === 'hidden') void flush();
  };
  win?.addEventListener('pagehide', onPageHide);
  doc?.addEventListener('visibilitychange', onVisibilityChange);

  const adapter: IdbPersistence = {
    get durable() {
      return available && lastWriteOk && !superseded;
    },
    load,
    write,
    flush,
    commit,
    dispose() {
      win?.removeEventListener('pagehide', onPageHide);
      doc?.removeEventListener('visibilitychange', onVisibilityChange);
      channel?.close();
      if (active === adapter) active = null;
    },
  };
  active = adapter;
  return adapter;
}

/**
 * Stores a replacement save together with the backup slot in one transaction (import, restore, reset),
 * so closing the page right after can't leave the backup written but the new save not. Goes through
 * the page's adapter (which drops its older pending write); without one, writes IndexedDB directly.
 * Resolves false when nothing was stored. Call `replaceSave(save)` after it resolves true.
 */
export async function commitSave(save: Save, backup: SaveBackup | null): Promise<boolean> {
  if (active) return active.commit(save, backup);
  try {
    await defaultKeyValue().setMany(commitEntries(save, backup));
    return true;
  } catch {
    return false;
  }
}
