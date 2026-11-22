import { describe, expect, it } from 'vitest';
import { IV_MAX } from '@/shared/config/economy';
import { NATURES, saveSchema } from '../model/schema';
import { migrateFromV1, v1TrainerName } from './fromV1';
import { V1_ROSTER_KEY, V1_TRAINER_KEY } from './keys';
import { parseV1Trainers, readV1Doc } from './v1';

const ash = {
  id: 'a',
  firstName: 'Ash',
  lastName: 'Ketchum',
  team: ['pikachu', 'bulbasaur', 'charmander', 'squirtle'],
  savedAt: '2024-01-01T00:00:00.000Z',
};
const misty = {
  id: 'b',
  firstName: 'Misty',
  lastName: '',
  team: ['squirtle', 'not-a-pokemon', 'gengar', 'pikachu'],
  savedAt: '2024-02-01T00:00:00.000Z',
};

/** A read-only localStorage stand-in: any write or removal fails the test. */
function storage(entries: Record<string, string>) {
  return {
    getItem: (key: string) => entries[key] ?? null,
    setItem: () => {
      throw new Error('v1 keys must not be written');
    },
    removeItem: () => {
      throw new Error('v1 keys must not be removed');
    },
  };
}

describe('parseV1Trainers', () => {
  it('keeps valid trainers in order and skips broken entries', () => {
    expect(parseV1Trainers([ash, { firstName: 1 }, misty, null])).toEqual([
      { firstName: 'Ash', lastName: 'Ketchum', team: ash.team },
      { firstName: 'Misty', lastName: '', team: misty.team },
    ]);
  });

  it('returns nothing for a non-array', () => {
    expect(parseV1Trainers({ trainers: [ash] })).toEqual([]);
  });
});

describe('readV1Doc', () => {
  it('reads the roster key', () => {
    const doc = readV1Doc(storage({ [V1_ROSTER_KEY]: JSON.stringify([ash, misty]) }));
    expect(parseV1Trainers(doc)).toHaveLength(2);
  });

  it('reads the older single-trainer key', () => {
    const { id: _id, ...legacy } = ash;
    const doc = readV1Doc(storage({ [V1_TRAINER_KEY]: JSON.stringify(legacy) }));
    expect(parseV1Trainers(doc)).toEqual([
      { firstName: 'Ash', lastName: 'Ketchum', team: ash.team },
    ]);
  });

  it('appends the legacy trainer after the roster unless the roster already absorbed it', () => {
    const { id: _id, ...legacy } = ash;
    const both = storage({
      [V1_ROSTER_KEY]: JSON.stringify([misty]),
      [V1_TRAINER_KEY]: JSON.stringify(legacy),
    });
    expect(parseV1Trainers(readV1Doc(both)).map((t) => t.firstName)).toEqual(['Misty', 'Ash']);

    const absorbed = storage({
      [V1_ROSTER_KEY]: JSON.stringify([{ ...ash, id: `legacy-${ash.savedAt}` }]),
      [V1_TRAINER_KEY]: JSON.stringify(legacy),
    });
    expect(parseV1Trainers(readV1Doc(absorbed))).toHaveLength(1);
  });

  it('returns null for missing, broken or blocked storage', () => {
    expect(readV1Doc(null)).toBeNull();
    expect(readV1Doc(storage({}))).toBeNull();
    expect(readV1Doc(storage({ [V1_ROSTER_KEY]: '{not json' }))).toBeNull();
    expect(readV1Doc(storage({ [V1_ROSTER_KEY]: '[]' }))).toBeNull();
    const blocked = {
      getItem: () => {
        throw new DOMException('denied', 'SecurityError');
      },
    };
    expect(readV1Doc(blocked)).toBeNull();
  });
});

describe('v1TrainerName', () => {
  it('joins first and last name', () => {
    expect(v1TrainerName({ firstName: ' Ash ', lastName: 'Ketchum', team: [] })).toBe(
      'Ash Ketchum',
    );
  });

  it('cuts to the schema length and falls back to "Trainer"', () => {
    const long = v1TrainerName({
      firstName: 'Bartholomew',
      lastName: 'Montgomery-Smithson',
      team: [],
    });
    expect(long.length).toBeLessThanOrEqual(24);
    expect(long).toBe('Bartholomew Montgomery-S');
    expect(v1TrainerName({ firstName: '  ', lastName: '', team: [] })).toBe('Trainer');
    expect(v1TrainerName(undefined)).toBe('Trainer');
  });
});

describe('migrateFromV1', () => {
  const now = 1_700_000_000_000;

  it('imports every distinct known Pokémon at Lv 1 / 1★ and skips onboarding', () => {
    const save = migrateFromV1([ash, misty], { now });
    expect(save).not.toBeNull();
    if (!save) return;
    expect(saveSchema.safeParse(save).success).toBe(true);
    // pikachu, bulbasaur, charmander, squirtle, gengar — duplicates and the unknown slug dropped
    expect(
      Object.keys(save.collection)
        .map(Number)
        .sort((a, b) => a - b),
    ).toEqual([1, 4, 7, 25, 94]);
    for (const owned of Object.values(save.collection)) {
      expect(owned).toMatchObject({ level: 1, stars: 1, xp: 0, dupes: 0, talents: [] });
      expect(NATURES).toContain(owned.nature);
      for (const iv of Object.values(owned.ivs)) {
        expect(iv).toBeGreaterThanOrEqual(0);
        expect(iv).toBeLessThanOrEqual(IV_MAX);
      }
    }
    expect(save.team).toEqual([25]);
    expect(save.onboarding.step).toBe('done');
    expect(save.meta.migratedFromV1).toBe(true);
    expect(save.trainer.name).toBe('Ash Ketchum');
  });

  it('rolls the same IVs and nature on every run', () => {
    const a = migrateFromV1([ash, misty], { now });
    const b = migrateFromV1([ash, misty], { now: now + 86_400_000 });
    expect(a?.meta.seed).toBe(b?.meta.seed);
    for (const [id, owned] of Object.entries(a?.collection ?? {})) {
      expect(b?.collection[id]?.ivs).toEqual(owned.ivs);
      expect(b?.collection[id]?.nature).toBe(owned.nature);
    }
  });

  it('gives different rosters different seeds', () => {
    expect(migrateFromV1([ash], { now })?.meta.seed).not.toBe(
      migrateFromV1([misty], { now })?.meta.seed,
    );
  });

  it('leads with the first trainer’s first known Pokémon', () => {
    const unknownFirst = { ...ash, team: ['missingno', 'eevee', 'snorlax', 'pikachu'] };
    expect(migrateFromV1([unknownFirst, misty], { now })?.team).toEqual([133]);
    const allUnknown = { ...ash, team: ['missingno', 'glitch-a', 'glitch-b', 'glitch-c'] };
    const save = migrateFromV1([allUnknown, misty], { now });
    expect(save?.team).toEqual([7]);
    expect(save?.trainer.name).toBe('Ash Ketchum');
  });

  it('returns null when no slug maps to a known species', () => {
    expect(migrateFromV1([{ ...ash, team: ['missingno'] }], { now })).toBeNull();
    expect(migrateFromV1([], { now })).toBeNull();
    expect(migrateFromV1('garbage', { now })).toBeNull();
  });
});
