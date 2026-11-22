import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStorageStore } from './storageStore';

afterEach(() => vi.unstubAllGlobals());

describe('createStorageStore', () => {
  it('returns the server value outside the browser and never reads storage', () => {
    const read = vi.fn(() => 5);
    const store = createStorageStore({ read, write: () => true, serverValue: 0 });
    expect(store.get()).toBe(0);
    expect(read).not.toHaveBeenCalled();
  });

  it('reads storage once, lazily, in the browser', () => {
    vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
    const read = vi.fn(() => 5);
    const store = createStorageStore({ read, write: () => true, serverValue: 0 });
    expect(read).not.toHaveBeenCalled();
    expect(store.get()).toBe(5);
    expect(store.get()).toBe(5);
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('writes and notifies on change, skipping no-op updates', () => {
    vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
    const write = vi.fn(() => true);
    const store = createStorageStore({ read: () => 1, write, serverValue: 0 });
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.set((n) => n + 1);
    expect(store.get()).toBe(2);
    expect(write).toHaveBeenCalledWith(2);
    expect(listener).toHaveBeenCalledTimes(1);

    store.set(2);
    expect(write).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    store.set(3);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('re-reads when another tab changes the watched key', () => {
    const handlers: Record<string, (e: { key: string | null }) => void> = {};
    vi.stubGlobal('window', {
      addEventListener: (type: string, fn: (e: { key: string | null }) => void) =>
        (handlers[type] = fn),
      removeEventListener: vi.fn(),
    });
    let stored = 1;
    const store = createStorageStore({
      read: () => stored,
      write: () => true,
      serverValue: 0,
      syncKey: 'k',
    });
    const listener = vi.fn();
    store.subscribe(listener);
    expect(store.get()).toBe(1);

    stored = 7;
    handlers.storage?.({ key: 'other' });
    expect(listener).not.toHaveBeenCalled();
    handlers.storage?.({ key: 'k' });
    expect(store.get()).toBe(7);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('re-reads storage when a subscriber returns after a gap, so writes never build on stale data', () => {
    vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
    let stored = ['a'];
    const write = vi.fn((v: string[]) => {
      stored = v;
      return true;
    });
    const store = createStorageStore<string[]>({
      read: () => stored,
      write,
      serverValue: [],
      syncKey: 'k',
    });
    const unsubscribe = store.subscribe(vi.fn());
    expect(store.get()).toEqual(['a']);
    unsubscribe();

    stored = ['a', 'x']; // another tab saved while nobody listened (no storage event reached us)
    store.subscribe(vi.fn());
    expect(store.get()).toEqual(['a', 'x']);
    store.set((current) => [...current, 'y']);
    expect(stored).toEqual(['a', 'x', 'y']);
  });

  it('keeps the in-memory value when storage refused the write (never re-reads over it)', () => {
    vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
    const store = createStorageStore<string[]>({
      read: () => [],
      write: () => false,
      serverValue: [],
      syncKey: 'k',
    });
    const unsubscribe = store.subscribe(vi.fn());
    store.set(['saved in memory']);
    unsubscribe();
    store.subscribe(vi.fn()); // e.g. client-side navigation remounts the only consumer
    expect(store.get()).toEqual(['saved in memory']);
  });
});
