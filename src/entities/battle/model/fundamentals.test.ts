import { describe, expect, it } from 'vitest';
import type { PokemonType } from '@/entities/pokemon';
import { createRng } from './rng';
import { effectiveness } from './typeChart';
import { statsAtLevel } from './stats';
import type { MoveType } from './types';

describe('createRng', () => {
  it('is deterministic per seed and in [0,1)', () => {
    const a = createRng(42),
      b = createRng(42);
    const xs = Array.from({ length: 5 }, a),
      ys = Array.from({ length: 5 }, b);
    expect(xs).toEqual(ys);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    expect(createRng(43)()).not.toBe(xs[0]);
  });
});

describe('effectiveness', () => {
  it.each([
    ['fire', ['grass'], 2],
    ['water', ['fire'], 2],
    ['fire', ['water'], 0.5],
    ['electric', ['ground'], 0],
    ['normal', ['ghost'], 0],
    ['ground', ['flying'], 0],
    ['ice', ['grass', 'flying'], 4],
    ['fire', ['water', 'rock'], 0.25],
    ['fighting', ['normal'], 2],
    ['typeless', ['ghost'], 1],
  ])('%s vs %j = %s', (m, d, e) =>
    expect(effectiveness(m as MoveType, d as PokemonType[])).toBe(e),
  );
});

describe('statsAtLevel', () => {
  it('uses the level-50 formula with IV 31, EV 0', () => {
    // Pikachu base 35/55/40/50/50/90
    expect(
      statsAtLevel({
        hp: 35,
        attack: 55,
        defense: 40,
        specialAttack: 50,
        specialDefense: 50,
        speed: 90,
      }),
    ).toEqual({
      hp: 110,
      attack: 75,
      defense: 60,
      specialAttack: 70,
      specialDefense: 70,
      speed: 110,
    });
  });
});
