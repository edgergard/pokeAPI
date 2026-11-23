import { afterEach, describe, expect, it, vi } from 'vitest';
import { createNewSave } from '../model/schema';
import { LOAD_ERROR_UNAVAILABLE, createDefaultPersistence, migrateSave } from '.';
import { SAVE_KEY, V1_ROSTER_KEY } from './keys';
import type { KeyValueStore } from './kv';

/** The migration chain is a lazy chunk: simulate it failing to load (offline, stale deploy). */
function breakChunk() {
  vi.doMock('./migrations', () => {
    throw new Error('Failed to fetch dynamically imported module');
  });
}

const roster = JSON.stringify([
  { id: 'a', firstName: 'Ash', lastName: 'K', team: ['pikachu'], savedAt: 'x' },
]);
const local = { getItem: (key: string) => (key === V1_ROSTER_KEY ? roster : null) };

function memoryKv(initial: Record<string, unknown> = {}) {
  const data = new Map(Object.entries(initial));
  const writes: unknown[] = [];
  const kv: KeyValueStore & { data: typeof data; writes: unknown[] } = {
    data,
    writes,
    get: async (key) => data.get(key),
    set: async (key, value) => {
      writes.push([key, value]);
      data.set(key, value);
    },
    setMany: async (entries) => {
      writes.push(entries);
      for (const [key, value] of entries) data.set(key, value);
    },
  };
  return kv;
}

const options = { window: null, document: null, channel: null, debounceMs: 0, localStorage: local };

describe('migration chunk failing to load', () => {
  afterEach(() => {
    vi.doUnmock('./migrations');
    vi.resetModules();
  });

  it('reports unavailable instead of a broken document', async () => {
    breakChunk();
    await expect(migrateSave(1, JSON.parse(roster), { now: 1 })).resolves.toEqual({
      ok: false,
      reason: 'unavailable',
    });
  });

  it('leaves save:v2 unwritten so the v1 import is retried on the next load', async () => {
    const kv = memoryKv();
    breakChunk();
    const first = createDefaultPersistence({ ...options, kv });
    expect(await first.load()).toEqual({ kind: 'empty' });
    expect(first.durable).toBe(false);
    // The store now starts a fresh save in memory and tries to write it: refused.
    await expect(first.write(createNewSave({ seed: 1, now: 1, name: 'Fresh' }))).resolves.toBe(
      false,
    );
    expect(kv.writes).toEqual([]);
    first.dispose();

    vi.doUnmock('./migrations');
    vi.resetModules();
    const { createDefaultPersistence: create } = await import('.');
    const second = create({ ...options, kv });
    const result = await second.load();
    expect(result).toMatchObject({ kind: 'loaded', save: { meta: { migratedFromV1: true } } });
    await second.flush();
    expect(kv.data.get(SAVE_KEY)).toMatchObject({ team: [25] });
  });

  it('does not write a fresh save to the sessionStorage fallback either (the v1 import must retry)', async () => {
    const session = {
      writes: 0,
      getItem: () => null,
      setItem() {
        this.writes += 1;
      },
    };
    breakChunk();
    const adapter = createDefaultPersistence({ ...options, kv: null, sessionStorage: session });
    expect(await adapter.load()).toEqual({ kind: 'empty' });
    await expect(adapter.write(createNewSave({ seed: 1, now: 1, name: 'Fresh' }))).resolves.toBe(
      false,
    );
    expect(session.writes).toBe(0);
  });

  it('keeps an older stored save untouched and says why', async () => {
    const stored = { version: 1 };
    const kv = memoryKv({ [SAVE_KEY]: stored });
    breakChunk();
    const adapter = createDefaultPersistence({ ...options, kv });
    expect(await adapter.load()).toEqual({ kind: 'error', reason: LOAD_ERROR_UNAVAILABLE });
    expect(adapter.durable).toBe(false);
    await expect(adapter.commit(createNewSave({ seed: 1, now: 1, name: 'X' }), null)).resolves.toBe(
      false,
    );
    expect(kv.data.get(SAVE_KEY)).toBe(stored);
  });
});
