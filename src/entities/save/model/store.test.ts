import { beforeEach, describe, expect, it } from 'vitest';
import { createNewSave } from './schema';
import {
  __resetSaveStoreForTests,
  getSave,
  getState,
  initSave,
  updateSave,
  type SavePersistence,
} from './store';

const fresh = () => createNewSave({ seed: 1, now: 0, name: 'Rowan' });

function memory(initial: ReturnType<typeof fresh> | null): SavePersistence & { writes: number } {
  let stored = initial;
  const p = {
    durable: true,
    writes: 0,
    async load() {
      return stored ? ({ kind: 'loaded', save: stored } as const) : ({ kind: 'empty' } as const);
    },
    async write(save: ReturnType<typeof fresh>) {
      stored = save;
      p.writes += 1;
      return true;
    },
  };
  return p;
}

describe('save store', () => {
  beforeEach(() => __resetSaveStoreForTests());

  it('creates a fresh save when storage is empty and writes it', async () => {
    const p = memory(null);
    await initSave(p, fresh);
    expect(getState().status).toBe('ready');
    expect(getSave()?.trainer.name).toBe('Rowan');
    expect(p.writes).toBe(1);
  });

  it('applies updates immutably and persists them', async () => {
    const p = memory(fresh());
    await initSave(p, fresh);
    const before = getSave();
    updateSave((s) => ({ ...s, dust: s.dust + 10 }));
    expect(getSave()?.dust).toBe(10);
    expect(before?.dust).toBe(0);
    expect(p.writes).toBe(1);
  });

  it('stays in error when loading fails', async () => {
    await initSave(
      {
        durable: true,
        load: async () => ({ kind: 'error', reason: 'corrupt' }),
        write: async () => true,
      },
      fresh,
    );
    expect(getState()).toMatchObject({ status: 'error', error: 'corrupt', save: null });
  });
});
