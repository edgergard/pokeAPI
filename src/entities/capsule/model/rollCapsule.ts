import { speciesOfRarity, type Species } from '@/entities/pokemon';
import type { GameEvent, OwnedPokemon, Save } from '@/entities/save';
import { economy, RARITIES, type CapsuleTier, type Rarity } from '@/shared/config/economy';
import { createRng, hashSeed } from '@/shared/lib/rng';
import { dupesForNextStar, isTierUnlocked, newOwnedPokemon, pickIndex } from './helpers';
import { maxRarity, rarityRank } from './rarity';
import {
  CapsuleError,
  type CapsuleResult,
  type OpenManyResult,
  type PullOutcome,
  type RollResult,
} from './types';

/** Species pools per rarity, built once (the baked data never changes at runtime). */
const pools = new Map<Rarity, Species[]>();
function poolOf(rarity: Rarity): Species[] {
  let pool = pools.get(rarity);
  if (!pool) {
    pool = speciesOfRarity(rarity);
    pools.set(rarity, pool);
  }
  return pool;
}

/** Maps a uniform draw in [0, 1) onto the tier's odds table (percent per rarity). */
export function rarityFromDraw(draw: number, tier: CapsuleTier): Rarity {
  const odds = economy.capsules.odds[tier];
  const target = draw * 100;
  let acc = 0;
  let last: Rarity = RARITIES[0];
  for (const rarity of RARITIES) {
    const weight = odds[rarity];
    if (weight <= 0) continue;
    last = rarity;
    acc += weight;
    if (target < acc) return rarity;
  }
  // Float rounding can leave the row a hair under 100: the remainder belongs to the last rarity.
  return last;
}

/** The minimum rarity this open must reach, and why (pity beats the first-capsule floor when higher). */
function floorFor(save: Save, tier: CapsuleTier): { rarity: Rarity; by: 'pity' | 'first' } | null {
  const pity = economy.capsules.pity[tier];
  const pityFloor = save.pity[tier] >= pity.opens - 1 ? pity.rarity : null;
  const firstFloor = save.capsulesOpened === 0 ? economy.capsules.firstCapsuleMinRarity : null;
  if (pityFloor && firstFloor) {
    return rarityRank(pityFloor) >= rarityRank(firstFloor)
      ? { rarity: pityFloor, by: 'pity' }
      : { rarity: firstFloor, by: 'first' };
  }
  if (pityFloor) return { rarity: pityFloor, by: 'pity' };
  if (firstFloor) return { rarity: firstFloor, by: 'first' };
  return null;
}

/**
 * Opens one capsule of `tier`. Pure and deterministic: the pull is seeded with
 * `hashSeed(meta.seed, 'pull', meta.pullIndex)` and one rng stream draws rarity, species, IVs and nature
 * in that order. The caller commits the returned save (and applies `events`) before any animation, so a
 * reload never re-rolls. Throws `CapsuleError` when the tier is empty or locked.
 */
export function rollCapsule(save: Save, tier: CapsuleTier, now: number): RollResult {
  if (save.capsules[tier] <= 0) {
    throw new CapsuleError('noCapsules', `No ${tier} capsules to open`);
  }
  if (!isTierUnlocked(save, tier)) {
    throw new CapsuleError('locked', `${tier} capsules are locked at this trainer level`);
  }

  const pullIndex = save.meta.pullIndex;
  const rng = createRng(hashSeed(save.meta.seed, 'pull', pullIndex));

  // 1. Rarity, raised to the highest floor.
  const rolled = rarityFromDraw(rng(), tier);
  const floor = floorFor(save, tier);
  const rarity = floor ? maxRarity(rolled, floor.rarity) : rolled;
  const raisedBy = floor && rarityRank(floor.rarity) > rarityRank(rolled) ? floor.by : null;

  // 2. Species: uniform within the rarity.
  const pool = poolOf(rarity);
  const species = pool[pickIndex(rng, pool.length)];
  if (!species) throw new CapsuleError('noSpecies', `No species of rarity ${rarity}`);
  const key = String(species.id);
  const owned = save.collection[key];

  // 3. New → IVs and nature from the same stream; duplicate → stars or dust.
  let outcome: PullOutcome;
  let pokemon: OwnedPokemon;
  let dustGained = 0;
  if (!owned) {
    outcome = 'new';
    pokemon = newOwnedPokemon(species.id, rng, now);
  } else if (owned.stars >= economy.pokemon.maxStars) {
    outcome = 'dust';
    dustGained = economy.dust.fromDuplicate[rarity];
    pokemon = owned;
  } else {
    const dupes = owned.dupes + 1;
    if (dupes >= dupesForNextStar(owned.stars)) {
      outcome = 'starUp';
      pokemon = { ...owned, stars: owned.stars + 1, dupes: 0 };
    } else {
      outcome = 'dupe';
      pokemon = { ...owned, dupes };
    }
  }

  // 4. Pity counter: reset on the pity rarity or better, otherwise +1.
  const pity = economy.capsules.pity[tier];
  const reset = rarityRank(rarity) >= rarityRank(pity.rarity);
  const pityCount = reset ? 0 : save.pity[tier] + 1;

  const next: Save = {
    ...save,
    meta: { ...save.meta, pullIndex: pullIndex + 1 },
    collection: pokemon === owned ? save.collection : { ...save.collection, [key]: pokemon },
    capsules: { ...save.capsules, [tier]: save.capsules[tier] - 1 },
    pity: { ...save.pity, [tier]: pityCount },
    capsulesOpened: save.capsulesOpened + 1,
    dust: save.dust + dustGained,
  };

  const result: CapsuleResult = {
    kind: 'capsule',
    tier,
    pullIndex,
    rarity,
    speciesId: species.id,
    outcome,
    level: pokemon.level,
    stars: pokemon.stars,
    dupes: pokemon.dupes,
    dupesForNextStar: dupesForNextStar(pokemon.stars),
    dustGained,
    pity: {
      tier,
      rarity: pity.rarity,
      opens: pity.opens,
      count: pityCount,
      left: pity.opens - Math.min(pityCount, pity.opens - 1),
      reset,
    },
    firstCapsule: save.capsulesOpened === 0,
    raisedBy,
  };

  const events: GameEvent[] = [
    { kind: 'capsuleOpened', tier, rarity, speciesId: species.id, duplicate: outcome !== 'new' },
  ];

  return { save: next, result, events };
}

/** Opens `count` capsules of `tier` in a row ("Open all"); results and events are in roll order. */
export function openMany(
  save: Save,
  tier: CapsuleTier,
  count: number,
  now: number,
): OpenManyResult {
  if (!Number.isInteger(count) || count < 1) {
    throw new CapsuleError('badCount', `Can't open ${count} capsules`);
  }
  if (count > save.capsules[tier]) {
    throw new CapsuleError('noCapsules', `Only ${save.capsules[tier]} ${tier} capsules to open`);
  }
  let current = save;
  const results: CapsuleResult[] = [];
  const events: GameEvent[] = [];
  for (let i = 0; i < count; i++) {
    const roll = rollCapsule(current, tier, now);
    current = roll.save;
    results.push(roll.result);
    events.push(...roll.events);
  }
  return { save: current, results, events };
}
