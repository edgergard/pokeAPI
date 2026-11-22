import { getSpecies } from '@/entities/pokemon';
import { NATURES, type OwnedPokemon, type Save } from '@/entities/save';
import { economy, IV_MAX, type CapsuleTier, type Rarity } from '@/shared/config/economy';
import { TIER_LABEL } from './rarity';

/** Trainer level a tier needs (1 = always open). */
export function tierUnlockLevel(tier: CapsuleTier): number {
  return tier === 'great' ? economy.trainer.unlocks.greatCapsules : 1;
}

/** Anything with a trainer level (a Save, or a slice of one). */
type HasTrainerLevel = { trainer: { level: number } };

export function isTierUnlocked(save: HasTrainerLevel, tier: CapsuleTier): boolean {
  return save.trainer.level >= tierUnlockLevel(tier);
}

/** "Great capsules unlock at Trainer Lv 8", or null when the tier is open. */
export function tierLockReason(save: HasTrainerLevel, tier: CapsuleTier): string | null {
  if (isTierUnlocked(save, tier)) return null;
  return `${TIER_LABEL[tier]} capsules unlock at Trainer Lv ${tierUnlockLevel(tier)}`;
}

export type PityStatus = {
  tier: CapsuleTier;
  rarity: Rarity;
  opens: number;
  /** Opens since the pity rarity (or better) last dropped. */
  count: number;
  /** Opens until the guarantee, counting the guaranteed one (≥ 1). */
  left: number;
};

/** Pity progress of a tier, for meters ("Rare guaranteed within 9 opens"). */
export function pityStatus(save: Pick<Save, 'pity'>, tier: CapsuleTier): PityStatus {
  const { rarity, opens } = economy.capsules.pity[tier];
  const count = Math.min(save.pity[tier], opens - 1);
  return { tier, rarity, opens, count, left: opens - count };
}

export function speciesRarity(speciesId: number): Rarity | undefined {
  return getSpecies(speciesId)?.rarity;
}

export function craftPrice(rarity: Rarity): number {
  return economy.dust.craftPrice[rarity];
}

/** Dust still needed to craft at `price` (0 when affordable). */
export function dustMissing(save: Pick<Save, 'dust'>, price: number): number {
  return Math.max(0, price - save.dust);
}

export function isOwned(save: Pick<Save, 'collection'>, speciesId: number): boolean {
  return save.collection[String(speciesId)] !== undefined;
}

/** Duplicates the next star needs from `stars` (0 at max stars). */
export function dupesForNextStar(stars: number): number {
  if (stars >= economy.pokemon.maxStars) return 0;
  return economy.pokemon.dupesForNextStar[stars] ?? 0;
}

const IV_STATS = [
  'hp',
  'attack',
  'defense',
  'specialAttack',
  'specialDefense',
  'speed',
] as const satisfies readonly (keyof OwnedPokemon['ivs'])[];

/** A freshly obtained Pokémon. Draws 6 IVs then the nature from `rng`, in that order. */
export function newOwnedPokemon(speciesId: number, rng: () => number, now: number): OwnedPokemon {
  const ivs = {} as OwnedPokemon['ivs'];
  for (const stat of IV_STATS) ivs[stat] = pickIndex(rng, IV_MAX + 1);
  const nature = NATURES[pickIndex(rng, NATURES.length)] ?? 'neutral';
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

/** Uniform integer in [0, n). */
export function pickIndex(rng: () => number, n: number): number {
  return Math.min(n - 1, Math.floor(rng() * n));
}
