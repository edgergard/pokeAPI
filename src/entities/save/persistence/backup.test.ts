import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import { createNewSave } from '../model/schema';
import { readBackup, writeBackup } from './backup';
import { BACKUP_KEY } from './keys';
import { createIdbKeyValue, type KeyValueStore } from './kv';

const save = createNewSave({ seed: 3, now: 10, name: 'Rowan' });

describe('backup slot', () => {
  let kv: KeyValueStore;

  beforeEach(() => {
    globalThis.indexedDB = new IDBFactory();
    kv = createIdbKeyValue();
  });

  it('is empty at first', async () => {
    await expect(readBackup(kv)).resolves.toBeNull();
  });

  it('stores a save with the time it was moved there', async () => {
    await expect(writeBackup(save, 1234, kv)).resolves.toBe(true);
    await expect(readBackup(kv)).resolves.toEqual({ savedAt: 1234, save });
    expect(await kv.get(BACKUP_KEY)).toEqual({ savedAt: 1234, save });
  });

  it('replaces the previous backup', async () => {
    await writeBackup(save, 1, kv);
    const other = { ...save, dust: 99 };
    await writeBackup(other, 2, kv);
    await expect(readBackup(kv)).resolves.toEqual({ savedAt: 2, save: other });
  });

  it('ignores a slot it cannot read', async () => {
    await kv.set(BACKUP_KEY, 'garbage');
    await expect(readBackup(kv)).resolves.toBeNull();
    await kv.set(BACKUP_KEY, { savedAt: 1, save: { version: 2 } });
    await expect(readBackup(kv)).resolves.toBeNull();
    await kv.set(BACKUP_KEY, { savedAt: 1, save: { ...save, version: 3 } });
    await expect(readBackup(kv)).resolves.toBeNull();
  });

  it('reports blocked storage instead of throwing', async () => {
    const blocked: KeyValueStore = {
      get: () => Promise.reject(new Error('blocked')),
      set: () => Promise.reject(new Error('blocked')),
    };
    await expect(readBackup(blocked)).resolves.toBeNull();
    await expect(writeBackup(save, 1, blocked)).resolves.toBe(false);
  });
});
