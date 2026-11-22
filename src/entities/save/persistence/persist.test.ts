import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { __resetPersistForTests, readPersistState, requestPersist } from './persist';

function stubStorage({ persisted = false, grant = false } = {}) {
  const storage = {
    persisted: vi.fn(async () => persisted),
    persist: vi.fn(async () => {
      persisted = grant;
      return grant;
    }),
  };
  vi.stubGlobal('navigator', { storage });
  return storage;
}

describe('persistent storage', () => {
  beforeEach(() => __resetPersistForTests());
  afterEach(() => vi.unstubAllGlobals());

  it('asks the browser at most once', async () => {
    const storage = stubStorage({ grant: true });
    await expect(Promise.all([requestPersist(), requestPersist()])).resolves.toEqual([true, true]);
    await expect(requestPersist()).resolves.toBe(true);
    expect(storage.persist).toHaveBeenCalledTimes(1);
    await expect(readPersistState()).resolves.toBe('persisted');
  });

  it('reports a denied request', async () => {
    stubStorage({ grant: false });
    await expect(requestPersist()).resolves.toBe(false);
    await expect(readPersistState()).resolves.toBe('denied');
  });

  it('reads an earlier grant without asking', async () => {
    const storage = stubStorage({ persisted: true });
    await expect(readPersistState()).resolves.toBe('persisted');
    expect(storage.persist).not.toHaveBeenCalled();
  });

  it('is not persisted until asked', async () => {
    stubStorage();
    await expect(readPersistState()).resolves.toBe('not-persisted');
  });

  it('resolves false where the API is missing', async () => {
    vi.stubGlobal('navigator', {});
    await expect(requestPersist()).resolves.toBe(false);
    await expect(readPersistState()).resolves.toBe('unsupported');
  });

  it('treats a throwing persist() as denied', async () => {
    vi.stubGlobal('navigator', {
      storage: {
        persisted: async () => false,
        persist: async () => {
          throw new Error('nope');
        },
      },
    });
    await expect(requestPersist()).resolves.toBe(false);
    await expect(readPersistState()).resolves.toBe('denied');
  });
});
