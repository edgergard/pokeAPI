import { describe, expect, it } from 'vitest';
import { statsAtLevel } from '@/entities/battle';
import { getSpecies } from '@/entities/pokemon';
import { NATURES } from '@/entities/save';
import { withPercent } from './math';
import { NATURE_EFFECTS, STAT_KEYS, computeStats, statBreakdown } from './stats';
import { makeOwned } from './testSaves';

const pikachu = getSpecies(25);
if (!pikachu) throw new Error('Pikachu missing from baked species');

describe('computeStats', () => {
  it('matches the Gen III formula for Pikachu Lv 50, IV 31, neutral', () => {
    const stats = computeStats(pikachu, makeOwned(25, { level: 50 }));
    expect(stats.hp).toBe(110);
    expect(stats.attack).toBe(75);
    expect(stats.speed).toBe(110);
  });

  it('equals the battle engine statsAtLevel with IV 31, neutral, no talents', () => {
    for (const level of [1, 5, 23, 50]) {
      expect(computeStats(pikachu, makeOwned(25, { level }))).toEqual(
        statsAtLevel(pikachu.stats, level),
      );
    }
  });

  it('applies the nature after the formula and never touches HP', () => {
    const neutral = computeStats(pikachu, makeOwned(25, { level: 50 }));
    const adamant = computeStats(pikachu, makeOwned(25, { level: 50, nature: 'adamant' }));
    expect(adamant.attack).toBe(82); // floor(75 × 1.1)
    expect(adamant.specialAttack).toBe(63); // floor(70 × 0.9)
    expect(adamant.hp).toBe(neutral.hp);
    expect(adamant.speed).toBe(neutral.speed);
  });

  it('defines a Gen III pair for every nature in the save schema', () => {
    expect(Object.keys(NATURE_EFFECTS).sort()).toEqual([...NATURES].sort());
    const base = computeStats(pikachu, makeOwned(25, { level: 50 }));
    for (const nature of NATURES) {
      const effect = NATURE_EFFECTS[nature];
      const stats = computeStats(pikachu, makeOwned(25, { level: 50, nature }));
      expect(stats.hp).toBe(base.hp);
      if (!effect) {
        expect(stats).toEqual(base);
        continue;
      }
      expect(effect.up).not.toBe(effect.down);
      expect(stats[effect.up]).toBeGreaterThan(base[effect.up]);
      expect(stats[effect.down]).toBeLessThan(base[effect.down]);
    }
    expect(NATURE_EFFECTS.brave).toEqual({ up: 'attack', down: 'speed' });
    expect(NATURE_EFFECTS.modest).toEqual({ up: 'specialAttack', down: 'attack' });
    expect(NATURE_EFFECTS.timid).toEqual({ up: 'speed', down: 'attack' });
  });

  it('changes with level and IVs', () => {
    const lv10 = computeStats(pikachu, makeOwned(25, { level: 10 }));
    const lv20 = computeStats(pikachu, makeOwned(25, { level: 20 }));
    for (const stat of STAT_KEYS) expect(lv20[stat]).toBeGreaterThan(lv10[stat]);
    const lowIv = makeOwned(25, { level: 50, ivs: { ...makeOwned(25).ivs, attack: 0 } });
    expect(computeStats(pikachu, lowIv).attack).toBe(Math.floor((2 * 55 * 50) / 100) + 5);
  });

  it('applies talent percents last, floored', () => {
    const owned = makeOwned(25, { level: 50, talents: ['offense-1', 'defense-1'] });
    const stats = computeStats(pikachu, owned);
    expect(stats.attack).toBe(81); // floor(75 × 1.08)
    expect(stats.hp).toBe(118); // floor(110 × 1.08)
    expect(stats.speed).toBe(110);
    // pre-talent values on demand
    expect(computeStats(pikachu, owned, []).attack).toBe(75);
  });

  it('stacks talent percents per stat before applying them', () => {
    const owned = makeOwned(25, {
      level: 50,
      nature: 'adamant',
      talents: ['offense-1', 'offense-2', 'offense-3', 'offense-4'],
    });
    const stats = computeStats(pikachu, owned);
    expect(stats.attack).toBe(Math.floor((82 * 118) / 100)); // +8% +10%
    expect(stats.specialAttack).toBe(Math.floor((63 * 118) / 100));
  });

  it('ignores unknown talent ids', () => {
    const owned = makeOwned(25, { level: 50, talents: ['nope'] });
    expect(computeStats(pikachu, owned)).toEqual(computeStats(pikachu, owned, []));
  });
});

describe('withPercent', () => {
  it('floors without float noise', () => {
    expect(100 * 1.15).toBeLessThan(115); // the float trap it avoids
    expect(withPercent(100, 15)).toBe(115);
    expect(withPercent(25, 10)).toBe(27);
    expect(withPercent(7, 0)).toBe(7);
  });
});

describe('statBreakdown', () => {
  it('splits formula and talent contribution', () => {
    const owned = makeOwned(25, { level: 50, nature: 'adamant', talents: ['offense-1'] });
    const lines = statBreakdown(pikachu, owned);
    expect(lines.attack).toEqual({
      base: 55,
      formula: 82,
      talentBonus: 6, // floor(82 × 1.08) = 88
      current: 88,
      nature: 'up',
    });
    expect(lines.specialAttack.nature).toBe('down');
    expect(lines.hp).toMatchObject({ base: 35, formula: 110, talentBonus: 0, current: 110 });
    for (const stat of STAT_KEYS) {
      expect(lines[stat].formula + lines[stat].talentBonus).toBe(lines[stat].current);
    }
  });
});
