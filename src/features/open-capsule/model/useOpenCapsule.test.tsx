// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rollCapsule } from '@/entities/capsule';
import { owned, testSave } from '@/entities/capsule/model/testSave';
import { allSpecies } from '@/entities/pokemon';
import {
  getSave,
  initSave,
  registerGameEventReducer,
  type GameEvent,
  type Save,
  type SavePersistence,
} from '@/entities/save';
import { __resetSaveStoreForTests } from '@/entities/save/model/store';
import { economy } from '@/shared/config/economy';
import { useCraft, useOpenCapsule } from './useOpenCapsule';

const NOW = 1_700_000_000_000;

const seen: GameEvent[] = [];
registerGameEventReducer((save, event) => {
  seen.push(event);
  return save;
});

function memory(initial: Save): SavePersistence & { written: Save[] } {
  const written: Save[] = [];
  return {
    durable: true,
    written,
    load: async () => ({ kind: 'loaded', save: initial }),
    write: async (save) => {
      written.push(save);
      return true;
    },
  };
}

async function load(save: Save) {
  const persistence = memory(save);
  await initSave(persistence, () => save);
  return persistence;
}

describe('useOpenCapsule', () => {
  beforeEach(() => {
    __resetSaveStoreForTests();
    seen.length = 0;
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
  });
  afterEach(() => vi.restoreAllMocks());

  it('commits one open to the store (and persistence) before returning the result', async () => {
    const before = testSave({ capsules: { basic: 3, great: 0 } });
    const persistence = await load(before);
    const { result } = renderHook(() => useOpenCapsule());

    const out = result.current.openOne('basic');
    if (!out.ok) throw new Error(out.error);

    const expected = rollCapsule(before, 'basic', NOW);
    expect(out.results).toEqual([expected.result]);
    expect(getSave()).toEqual(expected.save);
    expect(getSave()?.collection[String(expected.result.speciesId)]).toBeDefined();
    expect(persistence.written.at(-1)).toEqual(expected.save);
  });

  it('applies the capsuleOpened events through applyGameEvents', async () => {
    await load(testSave({ capsules: { basic: 2, great: 0 } }));
    const { result } = renderHook(() => useOpenCapsule());
    const out = result.current.openOne('basic');
    if (!out.ok) throw new Error(out.error);
    expect(seen).toEqual([
      {
        kind: 'capsuleOpened',
        tier: 'basic',
        rarity: out.results[0]?.rarity,
        speciesId: out.results[0]?.speciesId,
        duplicate: false,
      },
    ]);
  });

  it('opens every capsule of the tier with openAll', async () => {
    await load(testSave({ capsules: { basic: 4, great: 0 } }));
    const { result } = renderHook(() => useOpenCapsule());
    const out = result.current.openAll('basic');
    if (!out.ok) throw new Error(out.error);
    expect(out.results).toHaveLength(4);
    expect(getSave()?.capsules.basic).toBe(0);
    expect(getSave()?.meta.pullIndex).toBe(4);
    expect(seen).toHaveLength(4);
  });

  it('returns an error and changes nothing when there is nothing to open', async () => {
    const before = testSave();
    await load(before);
    const { result } = renderHook(() => useOpenCapsule());
    expect(result.current.openOne('basic')).toEqual({ ok: false, error: 'failed' });
    expect(getSave()).toBe(before);
    expect(seen).toHaveLength(0);
  });

  it('returns an error while the save is not loaded', () => {
    const { result } = renderHook(() => useOpenCapsule());
    expect(result.current.openOne('basic')).toEqual({ ok: false, error: 'notLoaded' });
  });
});

describe('useCraft', () => {
  const species = allSpecies.find((s) => s.rarity === 'uncommon');
  if (!species) throw new Error('no uncommon species');
  const price = economy.dust.craftPrice.uncommon;

  beforeEach(() => {
    __resetSaveStoreForTests();
    vi.spyOn(Date, 'now').mockReturnValue(NOW);
  });
  afterEach(() => vi.restoreAllMocks());

  it('commits the crafted Pokémon and spends the dust', async () => {
    await load(testSave({ dust: price + 1 }));
    const { result } = renderHook(() => useCraft());
    const out = result.current.craft(species.id);
    expect(out).toMatchObject({ ok: true, result: { speciesId: species.id, price } });
    expect(getSave()?.dust).toBe(1);
    expect(getSave()?.collection[String(species.id)]).toMatchObject({ obtainedAt: NOW });
  });

  it('reports the missing dust and leaves the save alone', async () => {
    const before = testSave({ dust: price - 40 });
    await load(before);
    const { result } = renderHook(() => useCraft());
    expect(result.current.craft(species.id)).toEqual({
      ok: false,
      reason: 'notEnoughDust',
      price,
      missing: 40,
    });
    expect(getSave()).toBe(before);
  });

  it('refuses an owned species', async () => {
    await load(testSave({ dust: 10_000, collection: { [String(species.id)]: owned(species.id) } }));
    const { result } = renderHook(() => useCraft());
    expect(result.current.craft(species.id)).toEqual({ ok: false, reason: 'owned' });
  });

  it('returns an error while the save is not loaded', () => {
    const { result } = renderHook(() => useCraft());
    expect(result.current.craft(species.id)).toEqual({ ok: false, reason: 'notLoaded' });
  });
});
