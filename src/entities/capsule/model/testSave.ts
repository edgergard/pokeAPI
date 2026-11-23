import { createNewSave, type OwnedPokemon, type Save } from '@/entities/save';

type SaveOverrides = Partial<Omit<Save, 'meta' | 'trainer'>> & {
  meta?: Partial<Save['meta']>;
  trainer?: Partial<Save['trainer']>;
};

/** A deterministic save for tests (seed 42, t = 0) with the given overrides. Test-only. */
export function testSave(overrides: SaveOverrides = {}): Save {
  const base = createNewSave({ seed: 42, now: 0, name: 'Tester' });
  const { meta, trainer, ...rest } = overrides;
  return {
    ...base,
    ...rest,
    meta: { ...base.meta, ...meta },
    trainer: { ...base.trainer, ...trainer },
  };
}

/** An owned Pokémon for tests. Test-only. */
export function owned(speciesId: number, fields: Partial<OwnedPokemon> = {}): OwnedPokemon {
  return {
    speciesId,
    level: 1,
    xp: 0,
    stars: 1,
    dupes: 0,
    ivs: { hp: 1, attack: 2, defense: 3, specialAttack: 4, specialDefense: 5, speed: 6 },
    nature: 'neutral',
    talents: [],
    obtainedAt: 0,
    ...fields,
  };
}
