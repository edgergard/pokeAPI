import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createNewSave, type Save } from '../model/schema';
import {
  __resetSaveStoreForTests,
  getSave,
  getState,
  initSave,
  replaceSave,
  updateSave,
} from '../model/store';
import { BACKUP_KEY, SAVE_KEY, V1_ROSTER_KEY } from './keys';
import { createIdbKeyValue, type KeyValueStore } from './kv';
import {
  LOAD_ERROR_DAMAGED,
  LOAD_ERROR_NEWER,
  commitSave,
  createDefaultPersistence,
  type PersistenceOptions,
} from '.';

const fresh = (name = 'Rowan'): Save => createNewSave({ seed: 1, now: 0, name });

/** No DOM lifecycle, no other tabs, no localStorage unless a test passes one. */
const base: PersistenceOptions = {
  window: null,
  document: null,
  localStorage: null,
  channel: null,
};

/** In-memory key-value store that counts writes; `fail` makes calls reject. */
function memoryKv(initial: Record<string, unknown> = {}) {
  const data = new Map(Object.entries(initial));
  const kv = {
    data,
    sets: [] as [string, unknown][],
    failGet: false,
    failSet: false,
    async get(key: string) {
      if (kv.failGet) throw new DOMException('blocked', 'InvalidStateError');
      return data.get(key);
    },
    async set(key: string, value: unknown) {
      if (kv.failSet) throw new DOMException('full', 'QuotaExceededError');
      kv.sets.push([key, value]);
      data.set(key, value);
    },
    /** One transaction: recorded as a single batch. */
    batches: [] as [string, unknown][][],
    async setMany(entries: [string, unknown][]) {
      if (kv.failSet) throw new DOMException('full', 'QuotaExceededError');
      kv.batches.push(entries);
      for (const [key, value] of entries) data.set(key, value);
    },
  };
  return kv;
}

describe('IndexedDB persistence (fake-indexeddb)', () => {
  let kv: KeyValueStore;

  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory(); // a fresh, empty database per test
    kv = createIdbKeyValue();
  });

  it('round-trips a save through trainer-studio / save:v2', async () => {
    const save = fresh();
    const first = createDefaultPersistence({ ...base, kv });
    expect(await first.load()).toEqual({ kind: 'empty' });
    const written = first.write(save);
    await first.flush();
    await expect(written).resolves.toBe(true);
    expect(first.durable).toBe(true);

    // A reload: a new adapter over a new connection to the same database.
    const reloaded = createDefaultPersistence({ ...base, kv: createIdbKeyValue() });
    expect(await reloaded.load()).toEqual({ kind: 'loaded', save });
    expect(await kv.get(SAVE_KEY)).toEqual(save);
  });

  it('survives a reload through the save store', async () => {
    __resetSaveStoreForTests();
    const adapter = createDefaultPersistence({ ...base, kv });
    await initSave(adapter, () => fresh());
    updateSave((s) => ({ ...s, dust: s.dust + 25 }));
    updateSave((s) => ({ ...s, dust: s.dust + 25 }));
    await adapter.flush();

    __resetSaveStoreForTests();
    await initSave(createDefaultPersistence({ ...base, kv: createIdbKeyValue() }), () =>
      fresh('Other'),
    );
    expect(getState().status).toBe('ready');
    expect(getSave()).toMatchObject({ dust: 50, trainer: { name: 'Rowan' } });
  });

  it('migrates the v1 roster on first load, stores it and leaves the v1 keys alone', async () => {
    const roster = JSON.stringify([
      { id: 'a', firstName: 'Ash', lastName: 'K', team: ['pikachu', 'eevee'], savedAt: 'x' },
    ]);
    const local = {
      getItem: vi.fn((key: string) => (key === V1_ROSTER_KEY ? roster : null)),
      setItem: vi.fn(),
      removeItem: vi.fn(),
    };
    const adapter = createDefaultPersistence({ ...base, kv, localStorage: local });
    const result = await adapter.load();
    expect(result.kind).toBe('loaded');
    if (result.kind !== 'loaded') return;
    expect(result.save.meta.migratedFromV1).toBe(true);
    await adapter.flush();
    expect(await kv.get(SAVE_KEY)).toEqual(result.save);
    expect(local.setItem).not.toHaveBeenCalled();
    expect(local.removeItem).not.toHaveBeenCalled();

    // Next load reads save:v2 and doesn't migrate again.
    local.getItem.mockClear();
    const again = await createDefaultPersistence({ ...base, kv, localStorage: local }).load();
    expect(again).toEqual(result);
    expect(local.getItem).not.toHaveBeenCalled();
  });
});

describe('stored document checks', () => {
  it.each([
    ['garbage', 'not a save', LOAD_ERROR_DAMAGED],
    ['an array', [1, 2, 3], LOAD_ERROR_DAMAGED],
    ['a broken current save', { ...fresh(), trainer: null }, LOAD_ERROR_DAMAGED],
    ['a newer save', { ...fresh(), version: 3 }, LOAD_ERROR_NEWER],
  ])('loads %s as an error and overwrites nothing', async (_label, stored, reason) => {
    const kv = memoryKv({ [SAVE_KEY]: stored });
    const adapter = createDefaultPersistence({ ...base, kv });
    expect(await adapter.load()).toEqual({ kind: 'error', reason });
    await adapter.flush();
    expect(kv.sets).toEqual([]);
    expect(kv.data.get(SAVE_KEY)).toBe(stored);
  });

  it('keeps the save store in error so nothing writes over the stored document', async () => {
    __resetSaveStoreForTests();
    const kv = memoryKv({ [SAVE_KEY]: { version: 99 } });
    const adapter = createDefaultPersistence({ ...base, kv });
    await initSave(adapter, () => fresh());
    updateSave((s) => ({ ...s, dust: 1 }));
    await adapter.flush();
    expect(getState()).toMatchObject({ status: 'error', error: LOAD_ERROR_NEWER });
    expect(kv.sets).toEqual([]);
  });

  it('never overwrites a newer save, even when the player starts over', async () => {
    __resetSaveStoreForTests();
    const newer = { ...fresh(), version: 3 };
    const kv = memoryKv({ [SAVE_KEY]: newer });
    const adapter = createDefaultPersistence({ ...base, kv, debounceMs: 0 });
    await initSave(adapter, () => fresh());
    expect(adapter.durable).toBe(false);
    replaceSave(fresh('Fresh start')); // e.g. "Start fresh" on the home error screen
    await adapter.flush();
    await expect(adapter.write(fresh())).resolves.toBe(false);
    await expect(adapter.commit(fresh(), null)).resolves.toBe(false);
    expect(kv.sets).toEqual([]);
    expect(kv.batches).toEqual([]);
    expect(kv.data.get(SAVE_KEY)).toBe(newer);
  });

  it('lets a damaged save be replaced (start fresh / import)', async () => {
    const kv = memoryKv({ [SAVE_KEY]: 'garbage' });
    const adapter = createDefaultPersistence({ ...base, kv });
    expect(await adapter.load()).toEqual({ kind: 'error', reason: LOAD_ERROR_DAMAGED });
    await expect(adapter.commit(fresh('New'), null)).resolves.toBe(true);
    expect(kv.data.get(SAVE_KEY)).toMatchObject({ trainer: { name: 'New' } });
  });
});

describe('commit (save + backup in one transaction)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes both keys at once and drops the older pending write', async () => {
    const kv = memoryKv();
    const adapter = createDefaultPersistence({ ...base, kv, debounceMs: 100 });
    const older = adapter.write({ ...fresh(), dust: 1 });
    const next = { ...fresh('Next'), dust: 2 };
    const backup = { savedAt: 5, save: { ...fresh('Old'), dust: 1 } };

    await expect(adapter.commit(next, backup)).resolves.toBe(true);
    await expect(older).resolves.toBe(true); // superseded by what was stored
    await vi.advanceTimersByTimeAsync(1000);
    expect(kv.batches).toEqual([
      [
        [SAVE_KEY, next],
        [BACKUP_KEY, backup],
      ],
    ]);
    expect(kv.sets).toEqual([]); // the older debounced write never landed after the commit
    expect(kv.data.get(SAVE_KEY)).toBe(next);
  });

  it('leaves the backup slot alone when there is nothing to back up', async () => {
    const kv = memoryKv({ [BACKUP_KEY]: 'keep me' });
    const adapter = createDefaultPersistence({ ...base, kv });
    await adapter.commit(fresh(), null);
    expect(kv.batches).toEqual([[[SAVE_KEY, fresh()]]]);
    expect(kv.data.get(BACKUP_KEY)).toBe('keep me');
  });

  it('stores nothing on failure and puts the cancelled write back', async () => {
    const kv = memoryKv();
    const adapter = createDefaultPersistence({ ...base, kv, debounceMs: 100 });
    const older = adapter.write({ ...fresh(), dust: 1 });
    kv.failSet = true;
    await expect(adapter.commit(fresh('Next'), null)).resolves.toBe(false);
    expect(kv.data.has(SAVE_KEY)).toBe(false);
    kv.failSet = false;
    await vi.advanceTimersByTimeAsync(100);
    await expect(older).resolves.toBe(true);
    expect(kv.data.get(SAVE_KEY)).toMatchObject({ dust: 1 });
  });
});

describe('commitSave', () => {
  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
  });

  it('survives closing the page right after a replace (no debounce window)', async () => {
    __resetSaveStoreForTests();
    const kv = createIdbKeyValue();
    const adapter = createDefaultPersistence({ ...base, kv, debounceMs: 60_000 });
    await initSave(adapter, () => fresh('Current'));
    await adapter.flush();

    const restored = fresh('Restored');
    await expect(commitSave(restored, { savedAt: 9, save: fresh('Current') })).resolves.toBe(true);
    replaceSave(restored);
    adapter.dispose(); // the tab closes before the 60 s debounce fires

    const reloaded = createDefaultPersistence({ ...base, kv: createIdbKeyValue() });
    expect(await reloaded.load()).toEqual({ kind: 'loaded', save: restored });
    expect(await kv.get(BACKUP_KEY)).toEqual({ savedAt: 9, save: fresh('Current') });
  });
});

describe('cross-tab guard', () => {
  let channelName: string;
  const opened: { dispose(): void }[] = [];
  const tab = (kv: KeyValueStore) => {
    const adapter = createDefaultPersistence({ ...base, kv, channel: channelName, debounceMs: 0 });
    opened.push(adapter);
    return adapter;
  };

  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    channelName = `trainer-studio-save-test-${Math.round(performance.now() * 1000)}`;
  });
  afterEach(() => {
    for (const adapter of opened.splice(0)) adapter.dispose();
  });

  it('stops a stale tab from writing over newer progress', async () => {
    const a = tab(createIdbKeyValue());
    const b = tab(createIdbKeyValue());
    await a.load();
    await b.load();

    await expect(a.write({ ...fresh('A'), dust: 50 })).resolves.toBe(true);
    await vi.waitFor(() => expect(b.durable).toBe(false), { timeout: 5000 });
    expect(a.durable).toBe(true);

    await expect(b.write({ ...fresh('B'), dust: 1 })).resolves.toBe(false);
    await expect(b.commit(fresh('B'), null)).resolves.toBe(false);
    const reloaded = createDefaultPersistence({ ...base, kv: createIdbKeyValue() });
    expect(await reloaded.load()).toMatchObject({ kind: 'loaded', save: { dust: 50 } });
  });

  it('drops the stale tab’s pending write', async () => {
    const a = tab(createIdbKeyValue());
    const b = createDefaultPersistence({
      ...base,
      kv: createIdbKeyValue(),
      channel: channelName,
      debounceMs: 60_000,
    });
    opened.push(b);
    await a.load();
    await b.load();
    const pending = b.write(fresh('B'));
    await a.write(fresh('A'));
    await expect(pending).resolves.toBe(false);
  });

  it('keeps a tab that loaded after the other tab’s write', async () => {
    const a = tab(createIdbKeyValue());
    await a.load();
    await a.write(fresh('A'));
    await new Promise((resolve) => setTimeout(resolve, 5));
    const b = tab(createIdbKeyValue());
    await b.load();
    await new Promise((resolve) => setTimeout(resolve, 20)); // any late message would have arrived
    expect(b.durable).toBe(true);

    // Now b writes: a is the stale one.
    await b.write(fresh('B'));
    await vi.waitFor(() => expect(a.durable).toBe(false), { timeout: 5000 });
    expect(b.durable).toBe(true);
  });

  it('ignores messages about writes older than its own last read', async () => {
    const a = tab(createIdbKeyValue());
    await a.load();
    const other = new BroadcastChannel(channelName);
    other.postMessage({ type: 'saved', tab: 'zzz', at: 0 });
    other.postMessage({ type: 'something else' });
    await new Promise((resolve) => setTimeout(resolve, 20));
    other.close();
    expect(a.durable).toBe(true);
  });
});

describe('debounced writes', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('coalesces a burst into one write of the last value', async () => {
    const kv = memoryKv();
    const adapter = createDefaultPersistence({ ...base, kv, debounceMs: 100 });
    const results = [1, 2, 3].map((dust) => adapter.write({ ...fresh(), dust }));
    await vi.advanceTimersByTimeAsync(99);
    expect(kv.sets).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(kv.sets).toHaveLength(1);
    expect(kv.sets[0]?.[1]).toMatchObject({ dust: 3 });
    await expect(Promise.all(results)).resolves.toEqual([true, true, true]);
  });

  it('does not hold a write longer than maxWait while updates keep coming', async () => {
    const kv = memoryKv();
    const adapter = createDefaultPersistence({ ...base, kv, debounceMs: 100, maxWaitMs: 300 });
    for (let i = 0; i < 6; i++) {
      void adapter.write({ ...fresh(), dust: i });
      await vi.advanceTimersByTimeAsync(60);
    }
    expect(kv.sets.length).toBeGreaterThanOrEqual(1);
    expect(kv.sets[0]?.[1]).toMatchObject({ dust: 4 });
  });

  it('flushes the pending write on pagehide and when the tab is hidden', async () => {
    const kv = memoryKv();
    const win = new EventTarget();
    const doc = Object.assign(new EventTarget(), {
      visibilityState: 'visible' as DocumentVisibilityState,
    });
    const adapter = createDefaultPersistence({
      ...base,
      kv,
      window: win,
      document: doc,
      debounceMs: 10_000,
    });

    const first = adapter.write({ ...fresh(), dust: 1 });
    win.dispatchEvent(new Event('pagehide'));
    await expect(first).resolves.toBe(true);
    expect(kv.sets).toHaveLength(1);

    const second = adapter.write({ ...fresh(), dust: 2 });
    doc.dispatchEvent(new Event('visibilitychange')); // still visible: nothing yet
    await Promise.resolve();
    expect(kv.sets).toHaveLength(1);
    doc.visibilityState = 'hidden';
    doc.dispatchEvent(new Event('visibilitychange'));
    await expect(second).resolves.toBe(true);
    expect(kv.sets[1]?.[1]).toMatchObject({ dust: 2 });

    adapter.dispose();
    void adapter.write({ ...fresh(), dust: 3 });
    win.dispatchEvent(new Event('pagehide'));
    await Promise.resolve();
    expect(kv.sets).toHaveLength(2);
  });

  it('resolves false when a write fails and recovers on the next one', async () => {
    const kv = memoryKv();
    const adapter = createDefaultPersistence({ ...base, kv, debounceMs: 0 });
    kv.failSet = true;
    const failed = adapter.write(fresh());
    await vi.advanceTimersByTimeAsync(0);
    await expect(failed).resolves.toBe(false);
    expect(adapter.durable).toBe(false);

    kv.failSet = false;
    const ok = adapter.write(fresh());
    await vi.advanceTimersByTimeAsync(0);
    await expect(ok).resolves.toBe(true);
    expect(adapter.durable).toBe(true);
  });
});

describe('blocked storage', () => {
  const roster = JSON.stringify([
    { id: 'a', firstName: 'Ash', lastName: 'K', team: ['pikachu'], savedAt: 'x' },
  ]);

  it('runs in memory when there is no IndexedDB at all', async () => {
    const original = globalThis.indexedDB;
    // @ts-expect-error -- simulate a browser without IndexedDB
    delete globalThis.indexedDB;
    try {
      const adapter = createDefaultPersistence(base);
      expect(adapter.durable).toBe(false);
      expect(await adapter.load()).toEqual({ kind: 'empty' });
      await expect(adapter.write(fresh())).resolves.toBe(false);
    } finally {
      globalThis.indexedDB = original;
    }
  });

  it('treats a failing open as blocked and never writes afterwards', async () => {
    const kv = memoryKv();
    kv.failGet = true;
    const adapter = createDefaultPersistence({ ...base, kv });
    expect(adapter.durable).toBe(true); // optimistic until the first read
    expect(await adapter.load()).toEqual({ kind: 'empty' });
    expect(adapter.durable).toBe(false);
    await expect(adapter.write(fresh())).resolves.toBe(false);
    expect(kv.sets).toEqual([]);
  });

  it('treats a hung open as blocked', async () => {
    const kv: KeyValueStore = {
      get: () => new Promise(() => {}),
      set: async () => {},
      setMany: async () => {},
    };
    const adapter = createDefaultPersistence({ ...base, kv, openTimeoutMs: 20 });
    expect(await adapter.load()).toEqual({ kind: 'empty' });
    expect(adapter.durable).toBe(false);
  });

  it('still migrates a v1 roster from localStorage, in memory', async () => {
    const adapter = createDefaultPersistence({
      ...base,
      kv: null,
      localStorage: { getItem: (key) => (key === V1_ROSTER_KEY ? roster : null) },
    });
    const result = await adapter.load();
    expect(result).toMatchObject({ kind: 'loaded', save: { team: [25] } });
    await expect(adapter.write(fresh())).resolves.toBe(false);
  });

  it('keeps the game playable through the store', async () => {
    __resetSaveStoreForTests();
    await initSave(createDefaultPersistence({ ...base, kv: null }), () => fresh());
    updateSave((s) => ({ ...s, dust: 5 }));
    await vi.waitFor(() => expect(getState().writeFailed).toBe(true), { timeout: 5000 });
    expect(getSave()?.dust).toBe(5);
  });

  it('never touches the backup key', async () => {
    const kv = memoryKv();
    const adapter = createDefaultPersistence({ ...base, kv, debounceMs: 0 });
    await adapter.load();
    await adapter.write(fresh());
    expect(kv.sets.map(([key]) => key)).toEqual([SAVE_KEY]);
    expect(kv.data.has(BACKUP_KEY)).toBe(false);
  });
});
