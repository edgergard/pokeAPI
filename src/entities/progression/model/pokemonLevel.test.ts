import { describe, expect, it } from 'vitest';
import { economy } from '@/shared/config/economy';
import {
  addPokemonXp,
  isAtLevelCap,
  levelCap,
  nextPokemonTalentPointLevel,
  pokemonTalentPointsAt,
  talentPointsAvailable,
  xpToNextLevel,
} from './pokemonLevel';
import { makeOwned } from './testSaves';

const medium = { growthRate: 'medium' }; // n³
const slow = { growthRate: 'slow' }; // 5n³/4

describe('xpToNextLevel', () => {
  it('scales the growth-rate step by the curve divisor and rounds', () => {
    // medium: (11³ − 10³) / 20 = 16.55 → 17 (rounded, not floored)
    expect(xpToNextLevel(medium, 10)).toBe(17);
    // medium: (50³ − 49³) / 20 = 367.55 → 368
    expect(xpToNextLevel(medium, 49)).toBe(368);
    // slow: (1663 − 1250) / 20 = 20.65 → 21
    expect(xpToNextLevel(slow, 10)).toBe(21);
    // medium: (4³ − 3³) / 20 = 1.85 → 2
    expect(xpToNextLevel(medium, 3)).toBe(2);
  });

  it('is at least 1', () => {
    // medium curve: Lv 1 = 0, Lv 2 = 8 → 8 / 20 = 0.4 → rounds to 0 → clamped to 1
    expect(xpToNextLevel(medium, 1)).toBe(1);
    for (let level = 1; level < economy.pokemon.maxLevel; level++) {
      expect(xpToNextLevel(slow, level)).toBeGreaterThanOrEqual(1);
    }
  });

  it('grows with level', () => {
    expect(xpToNextLevel(medium, 30)).toBeGreaterThan(xpToNextLevel(medium, 20));
  });
});

describe('levelCap', () => {
  it('follows economy.pokemon.levelCapByStars', () => {
    expect([1, 2, 3, 4, 5].map(levelCap)).toEqual([10, 20, 30, 40, 50]);
  });

  it('clamps out-of-range stars and never exceeds the max level', () => {
    expect(levelCap(0)).toBe(economy.pokemon.levelCapByStars[0]);
    expect(levelCap(9)).toBe(economy.pokemon.maxLevel);
    for (let stars = 0; stars <= 9; stars++) {
      expect(levelCap(stars)).toBeLessThanOrEqual(economy.pokemon.maxLevel);
    }
  });
});

describe('addPokemonXp', () => {
  it('adds XP towards the next level without levelling', () => {
    const owned = makeOwned(25, { level: 10, stars: 2, xp: 3 });
    const result = addPokemonXp(owned, medium, 10);
    expect(result.owned).toMatchObject({ level: 10, xp: 13 });
    expect(result.levelsGained).toBe(0);
    expect(result.atCap).toBe(false);
  });

  it('carries overflow across several levels', () => {
    // medium steps from Lv 1: 1, 1, 2, 3, 5, 6, 8, 11, 14 → 37 XP reaches Lv 9
    const owned = makeOwned(25, { level: 1 });
    const result = addPokemonXp(owned, medium, 50);
    expect(result.owned).toMatchObject({ level: 9, xp: 13 });
    expect(result.levelsGained).toBe(8);
  });

  it('stops at the star cap and drops the rest (xp stays 0)', () => {
    const owned = makeOwned(25, { level: 9, stars: 1, xp: 5 });
    const result = addPokemonXp(owned, medium, 100_000);
    expect(result.owned).toMatchObject({ level: 10, xp: 0 });
    expect(result.levelsGained).toBe(1);
    expect(result.atCap).toBe(true);
    expect(isAtLevelCap(result.owned)).toBe(true);
  });

  it('returns the same object at the cap (XP is lost, not banked)', () => {
    const owned = makeOwned(25, { level: 10, stars: 1 });
    const result = addPokemonXp(owned, medium, 500);
    expect(result.owned).toBe(owned);
    expect(result.atCap).toBe(true);
  });

  it('lets XP flow again after a star-up', () => {
    const capped = makeOwned(25, { level: 10, stars: 1 });
    const starred = { ...capped, stars: 2 };
    const result = addPokemonXp(starred, medium, xpToNextLevel(medium, 10));
    expect(result.owned).toMatchObject({ level: 11, xp: 0 });
  });

  it('never goes past the max level', () => {
    const owned = makeOwned(25, { level: 49, stars: 5 });
    const result = addPokemonXp(owned, medium, 10_000_000);
    expect(result.owned).toMatchObject({ level: economy.pokemon.maxLevel, xp: 0 });
  });

  it('does not mutate its input', () => {
    const owned = makeOwned(25, { level: 1 });
    const before = structuredClone(owned);
    addPokemonXp(owned, medium, 999);
    expect(owned).toEqual(before);
  });
});

describe('talent points', () => {
  it('earns one point every talentPointEveryLevels levels', () => {
    expect(pokemonTalentPointsAt(4)).toBe(0);
    expect(pokemonTalentPointsAt(5)).toBe(1);
    expect(pokemonTalentPointsAt(14)).toBe(2);
    expect(pokemonTalentPointsAt(50)).toBe(10);
  });

  it('subtracts learned talents and never goes negative', () => {
    expect(talentPointsAvailable({ level: 4, talents: [] })).toBe(0);
    expect(talentPointsAvailable({ level: 5, talents: [] })).toBe(1);
    expect(talentPointsAvailable({ level: 12, talents: ['offense-1'] })).toBe(1);
    expect(talentPointsAvailable({ level: 5, talents: ['offense-1', 'offense-2'] })).toBe(0);
  });

  it('names the next point level', () => {
    expect(nextPokemonTalentPointLevel(1)).toBe(5);
    expect(nextPokemonTalentPointLevel(5)).toBe(10);
    expect(nextPokemonTalentPointLevel(49)).toBe(50);
    expect(nextPokemonTalentPointLevel(50)).toBeNull();
  });
});
