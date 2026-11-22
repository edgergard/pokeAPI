import type { CapsuleResult, CraftResult } from '@/entities/capsule';
import { getSpecies } from '@/entities/pokemon';
import { economy } from '@/shared/config/economy';

/** A capsule result for tests; rarity follows the species unless overridden. Test-only. */
export function capsuleResult(
  speciesId: number,
  fields: Partial<CapsuleResult> = {},
): CapsuleResult {
  const rarity = fields.rarity ?? getSpecies(speciesId)?.rarity ?? 'common';
  const { rarity: pityRarity, opens } = economy.capsules.pity.basic;
  return {
    kind: 'capsule',
    tier: 'basic',
    pullIndex: 0,
    rarity,
    speciesId,
    outcome: 'new',
    level: 1,
    stars: 1,
    dupes: 0,
    dupesForNextStar: economy.pokemon.dupesForNextStar[1] ?? 0,
    dustGained: 0,
    pity: { tier: 'basic', rarity: pityRarity, opens, count: 1, left: opens - 1, reset: false },
    firstCapsule: false,
    raisedBy: null,
    ...fields,
  };
}

/** A craft result for tests. Test-only. */
export function craftResult(speciesId: number): CraftResult {
  const rarity = getSpecies(speciesId)?.rarity ?? 'common';
  return {
    kind: 'craft',
    rarity,
    speciesId,
    outcome: 'new',
    level: 1,
    stars: 1,
    dupes: 0,
    dupesForNextStar: economy.pokemon.dupesForNextStar[1] ?? 0,
    dustGained: 0,
    price: economy.dust.craftPrice[rarity],
  };
}
