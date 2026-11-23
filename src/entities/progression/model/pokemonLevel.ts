import { growthTotalXp, type Species } from '@/entities/pokemon';
import type { OwnedPokemon } from '@/entities/save';
import { economy } from '@/shared/config/economy';

/**
 * XP an owned Pokémon needs to go from `level` to `level + 1`: the PokeAPI growth-rate step scaled by
 * `economy.pokemon.xpCurveDivisor`, rounded, at least 1.
 */
export function xpToNextLevel(species: Pick<Species, 'growthRate'>, level: number): number {
  const step =
    growthTotalXp(species.growthRate, level + 1) - growthTotalXp(species.growthRate, level);
  return Math.max(1, Math.round(step / economy.pokemon.xpCurveDivisor));
}

/** Highest level a Pokémon with `stars` stars can reach (never above `economy.pokemon.maxLevel`). */
export function levelCap(stars: number): number {
  const caps = economy.pokemon.levelCapByStars;
  const index = Math.min(Math.max(Math.floor(stars), 0), caps.length - 1);
  const cap = caps[index] ?? economy.pokemon.maxLevel;
  return Math.min(cap, economy.pokemon.maxLevel);
}

/** Whether the Pokémon sits at its star level cap (further XP is lost until a star-up). */
export function isAtLevelCap(owned: Pick<OwnedPokemon, 'level' | 'stars'>): boolean {
  return owned.level >= levelCap(owned.stars);
}

export type PokemonXpResult = {
  owned: OwnedPokemon;
  levelsGained: number;
  /** True when the Pokémon ends at its star level cap. */
  atCap: boolean;
};

/**
 * Adds battle/quest XP to an owned Pokémon. `owned.xp` is XP towards the next level; overflow carries
 * across several levels. At the star cap the level stops and `xp` stays 0 (XP past the cap is lost).
 */
export function addPokemonXp(
  owned: OwnedPokemon,
  species: Pick<Species, 'growthRate'>,
  amount: number,
): PokemonXpResult {
  const cap = levelCap(owned.stars);
  let level = owned.level;
  let xp = owned.xp + Math.max(0, Math.floor(amount));
  while (level < cap) {
    const need = xpToNextLevel(species, level);
    if (xp < need) break;
    xp -= need;
    level += 1;
  }
  if (level >= cap) xp = 0;
  const atCap = level >= cap;
  if (level === owned.level && xp === owned.xp) return { owned, levelsGained: 0, atCap };
  return { owned: { ...owned, level, xp }, levelsGained: level - owned.level, atCap };
}

/** Pokémon talent points earned by `level` (one every `economy.pokemon.talentPointEveryLevels`). */
export function pokemonTalentPointsAt(level: number): number {
  return Math.floor(level / economy.pokemon.talentPointEveryLevels);
}

/** Unspent Pokémon talent points (never negative). */
export function talentPointsAvailable(owned: Pick<OwnedPokemon, 'level' | 'talents'>): number {
  return Math.max(0, pokemonTalentPointsAt(owned.level) - owned.talents.length);
}

/**
 * The next level (above `level`) that grants a Pokémon talent point, or null past the max level.
 * Drives "First talent point at Lv 5" / "Next point at Lv 10".
 */
export function nextPokemonTalentPointLevel(level: number): number | null {
  const every = economy.pokemon.talentPointEveryLevels;
  const next = (Math.floor(level / every) + 1) * every;
  return next <= economy.pokemon.maxLevel ? next : null;
}
