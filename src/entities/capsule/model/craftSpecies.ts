import { getSpecies } from '@/entities/pokemon';
import type { Save } from '@/entities/save';
import { createRng, hashSeed } from '@/shared/lib/rng';
import { craftPrice, dupesForNextStar, isOwned, newOwnedPokemon } from './helpers';
import type { CraftOutcome } from './types';

/**
 * Buys one unowned species with dust (economy.dust.craftPrice by rarity). Pure: IVs and nature are seeded
 * with `hashSeed(meta.seed, 'craft', speciesId)`, so crafting the same species in the same save always
 * gives the same Pokémon. Emits no game event. Failures are typed, never thrown.
 */
export function craftSpecies(save: Save, speciesId: number, now: number): CraftOutcome {
  const species = getSpecies(speciesId);
  if (!species) return { ok: false, reason: 'unknownSpecies' };
  if (isOwned(save, speciesId)) return { ok: false, reason: 'owned' };

  const price = craftPrice(species.rarity);
  if (save.dust < price) {
    return { ok: false, reason: 'notEnoughDust', price, missing: price - save.dust };
  }

  const rng = createRng(hashSeed(save.meta.seed, 'craft', speciesId));
  const pokemon = newOwnedPokemon(speciesId, rng, now);

  return {
    ok: true,
    save: {
      ...save,
      dust: save.dust - price,
      collection: { ...save.collection, [String(speciesId)]: pokemon },
    },
    result: {
      kind: 'craft',
      rarity: species.rarity,
      speciesId,
      outcome: 'new',
      level: pokemon.level,
      stars: pokemon.stars,
      dupes: pokemon.dupes,
      dupesForNextStar: dupesForNextStar(pokemon.stars),
      dustGained: 0,
      price,
    },
  };
}
