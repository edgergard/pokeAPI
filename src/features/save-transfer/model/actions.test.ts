import 'fake-indexeddb/auto';
import { clear, createStore } from 'idb-keyval';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createNewSave,
  getSave,
  initSave,
  readBackup,
  type Save,
  type SavePersistence,
} from '@/entities/save';
import { applyImport, exportSave, readSaveFile, resetProgress, restoreBackup } from './actions';
import { decodeSaveFile, encodeSaveFile } from './envelope';

const mine = createNewSave({ seed: 1, now: 100, name: 'Mine' });
const theirs = { ...createNewSave({ seed: 2, now: 200, name: 'Theirs' }), dust: 77 };

const memory: SavePersistence = {
  durable: true,
  load: async () => ({ kind: 'empty' }),
  write: async () => true,
};

async function start(save: Save | null) {
  await initSave(
    {
      ...memory,
      load: async () => (save ? { kind: 'loaded', save } : { kind: 'error', reason: 'x' }),
    },
    () => mine,
  );
}

describe('save-transfer actions', () => {
  beforeEach(async () => {
    await clear(createStore('trainer-studio', 'keyval'));
  });

  it('import moves the current save to the backup slot', async () => {
    await start(mine);
    await expect(applyImport(theirs, 5000)).resolves.toBe(true);
    expect(getSave()).toEqual(theirs);
    await expect(readBackup()).resolves.toEqual({ savedAt: 5000, save: mine });
  });

  it('import over an unreadable save just replaces it', async () => {
    await start(null);
    await expect(applyImport(theirs, 5000)).resolves.toBe(true);
    expect(getSave()).toEqual(theirs);
    await expect(readBackup()).resolves.toBeNull();
  });

  it('restore swaps the backup and the current save, and a second restore undoes it', async () => {
    await start(mine);
    await applyImport(theirs, 1);
    await expect(restoreBackup(2)).resolves.toBe('restored');
    expect(getSave()).toEqual(mine);
    await expect(readBackup()).resolves.toEqual({ savedAt: 2, save: theirs });
    await expect(restoreBackup(3)).resolves.toBe('restored');
    expect(getSave()).toEqual(theirs);
    await expect(readBackup()).resolves.toEqual({ savedAt: 3, save: mine });
  });

  it('restore reports an empty slot', async () => {
    await start(mine);
    await expect(restoreBackup()).resolves.toBe('empty');
    expect(getSave()).toEqual(mine);
  });

  it('changes nothing when the backup cannot be written', async () => {
    // A value IndexedDB can't clone makes the backup write fail.
    const unclonable = { ...mine, hook: () => 1 } as unknown as Save;
    await start(unclonable);
    await expect(applyImport(theirs)).resolves.toBe(false);
    await expect(resetProgress()).resolves.toBe(false);
    expect(getSave()).toBe(unclonable);
    await expect(readBackup()).resolves.toBeNull();
  });

  it('reset starts a fresh save and keeps the old one as backup', async () => {
    await start({ ...mine, onboarding: { ...mine.onboarding, step: 'done' } });
    await expect(resetProgress(9000, 4321)).resolves.toBe(true);
    expect(getSave()).toMatchObject({
      onboarding: { step: 'hero' },
      trainer: { name: 'Trainer 5321', level: 1 },
      meta: { seed: 4321, createdAt: 9000 },
      collection: {},
    });
    await expect(readBackup()).resolves.toMatchObject({
      savedAt: 9000,
      save: { trainer: { name: 'Mine' } },
    });
  });

  it('export downloads a file that restores the identical save and resets the reminder', async () => {
    await start({ ...mine, meta: { ...mine.meta, battlesSinceExport: 12 } });
    const download = vi.fn();
    const now = new Date(2026, 10, 22, 9).getTime();
    await expect(exportSave({ now, download })).resolves.toEqual({
      fileName: 'trainer-studio-2026-11-22.txt',
    });
    expect(getSave()?.meta).toMatchObject({ lastExportAt: now, battlesSinceExport: 0 });
    const [fileName, text] = download.mock.calls[0] as [string, string];
    expect(fileName).toBe('trainer-studio-2026-11-22.txt');
    await expect(decodeSaveFile(text, { now })).resolves.toEqual({
      ok: true,
      save: getSave(),
      migratedFrom: null,
    });
  });

  it('export does nothing without a save', async () => {
    await start(null);
    const download = vi.fn();
    await expect(exportSave({ download })).resolves.toBeNull();
    expect(download).not.toHaveBeenCalled();
  });

  it('reads a picked file and refuses oversized ones', async () => {
    const text = await encodeSaveFile(theirs, { now: 1, gameVersion: 'x' });
    await expect(readSaveFile(new Blob([text]))).resolves.toMatchObject({ ok: true, save: theirs });
    const huge = new Blob([new Uint8Array(6 * 1024 * 1024)]);
    await expect(readSaveFile(huge)).resolves.toEqual({ ok: false, error: 'damaged' });
  });
});
