import { getSpeciesBySlug } from '@/entities/pokemon';
import { IV_MAX } from '@/shared/config/economy';
import { createRng, hashSeed } from '@/shared/lib/rng';
import { NATURES, createNewSave, saveSchema, type OwnedPokemon, type Save } from '../model/schema';
import { parseV1Trainers, type V1Trainer } from './v1';

const FALLBACK_NAME = 'Trainer';
const NAME_MAX = saveSchema.shape.trainer.shape.name.maxLength ?? FALLBACK_NAME.length;

/** "firstName lastName", whitespace collapsed and cut to the schema's length; "Trainer" when empty. */
export function v1TrainerName(trainer: V1Trainer | undefined): string {
  const full = `${trainer?.firstName ?? ''} ${trainer?.lastName ?? ''}`.replace(/\s+/g, ' ').trim();
  const chars = Array.from(full); // code points, so an emoji is never cut in half
  while (chars.join('').length > NAME_MAX) chars.pop();
  return chars.join('').trim() || FALLBACK_NAME;
}

function rollOwned(seed: number, speciesId: number, now: number): OwnedPokemon {
  const rng = createRng(hashSeed(seed, 'v1', speciesId));
  const iv = () => Math.floor(rng() * (IV_MAX + 1));
  const ivs = {
    hp: iv(),
    attack: iv(),
    defense: iv(),
    specialAttack: iv(),
    specialDefense: iv(),
    speed: iv(),
  };
  const nature = NATURES[Math.floor(rng() * NATURES.length)] ?? NATURES[0];
  return {
    speciesId,
    level: 1,
    xp: 0,
    stars: 1,
    dupes: 0,
    ivs,
    nature,
    talents: [],
    obtainedAt: now,
  };
}

/**
 * Migration step from v1 (a roster array) to v2: every distinct known Pokémon becomes owned at Lv 1 / 1★
 * with IVs and nature rolled from a seed derived from the roster itself, so the same roster always yields
 * the same save. The team is the first trainer's first known Pokémon and onboarding is skipped.
 * Returns null when no slug maps to a known species (nothing to import). Pure.
 */
export function migrateFromV1(data: unknown, { now }: { now: number }): Save | null {
  const trainers = parseV1Trainers(data);
  const seed = hashSeed('v1', JSON.stringify(trainers));

  const collection: Save['collection'] = {};
  /** First known Pokémon of the first trainer, else of the first trainer that has one. */
  let lead: number | undefined;
  for (const trainer of trainers) {
    for (const slug of trainer.team) {
      const species = getSpeciesBySlug(slug);
      if (!species) continue;
      lead ??= species.id;
      const key = String(species.id);
      if (!collection[key]) collection[key] = rollOwned(seed, species.id, now);
    }
  }
  if (lead === undefined) return null;

  const fresh = createNewSave({ seed, now, name: v1TrainerName(trainers[0]) });
  return {
    ...fresh,
    meta: { ...fresh.meta, migratedFromV1: true },
    onboarding: { ...fresh.onboarding, step: 'done' },
    collection,
    team: [lead],
  };
}
