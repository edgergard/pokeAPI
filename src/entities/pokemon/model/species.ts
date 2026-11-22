import speciesData from '../data/species.json';
import growthData from '../data/growth-rates.json';
import type { Rarity } from '@/shared/config/economy';
import type { PokemonType, StatKey } from './types';

/** One species, baked from PokeAPI by `npm run species` (contract). */
export type Species = {
  id: number;
  /** PokeAPI slug of the default variety (key into the battle movesets). */
  slug: string;
  /** English display name. */
  name: string;
  types: PokemonType[];
  stats: Record<StatKey, number>;
  bst: number;
  generation: number;
  growthRate: string;
  legendary: boolean;
  baby: boolean;
  evolvesFrom: number | null;
  rarity: Rarity;
};

export const allSpecies = speciesData as Species[];

const byId = new Map(allSpecies.map((s) => [s.id, s]));
const bySlug = new Map(allSpecies.map((s) => [s.slug, s]));

export const SPECIES_COUNT = allSpecies.length;

export function getSpecies(id: number): Species | undefined {
  return byId.get(id);
}

export function getSpeciesBySlug(slug: string): Species | undefined {
  return bySlug.get(slug);
}

export function speciesOfRarity(rarity: Rarity): Species[] {
  return allSpecies.filter((s) => s.rarity === rarity);
}

const growth = growthData as Record<string, number[]>;

/**
 * Total XP to reach `level` on a PokeAPI growth-rate curve (level 1 = 0), before the game's scaling
 * (economy.pokemon.xpCurveDivisor). Unknown rates fall back to medium (n³).
 */
export function growthTotalXp(growthRate: string, level: number): number {
  const curve = growth[growthRate] ?? growth['medium'];
  const exact = curve?.[level - 1];
  return exact ?? level ** 3;
}
