// Test fixtures for progression tests (not used by production code).
import { createNewSave, type OwnedPokemon, type Save } from '@/entities/save';
import { IV_MAX } from '@/shared/config/economy';

export const T0 = new Date(2026, 10, 22, 12).getTime();

export function makeOwned(speciesId: number, overrides: Partial<OwnedPokemon> = {}): OwnedPokemon {
  return {
    speciesId,
    level: 1,
    xp: 0,
    stars: 1,
    dupes: 0,
    ivs: {
      hp: IV_MAX,
      attack: IV_MAX,
      defense: IV_MAX,
      specialAttack: IV_MAX,
      specialDefense: IV_MAX,
      speed: IV_MAX,
    },
    nature: 'neutral',
    talents: [],
    obtainedAt: T0,
    ...overrides,
  };
}

export function makeSave({
  owned = [],
  team = owned.map((p) => p.speciesId),
  trainer = {},
  ladder = {},
  seed = 42,
}: {
  owned?: OwnedPokemon[];
  team?: number[];
  trainer?: Partial<Save['trainer']>;
  ladder?: Partial<Save['ladder']>;
  seed?: number;
} = {}): Save {
  const save = createNewSave({ seed, now: T0, name: 'Ash' });
  return {
    ...save,
    trainer: { ...save.trainer, ...trainer },
    collection: Object.fromEntries(owned.map((p) => [String(p.speciesId), p])),
    team,
    ladder: { ...save.ladder, ...ladder },
    onboarding: { ...save.onboarding, step: 'done' },
  };
}
