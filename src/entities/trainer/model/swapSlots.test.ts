import { describe, expect, it } from 'vitest';
import { swapSlots } from './swapSlots';

const team = ['pikachu', 'bulbasaur', 'charmander', 'squirtle'] as const;

describe('swapSlots', () => {
  it('exchanges two slots', () => {
    expect(swapSlots(team, 0, 2)).toEqual(['charmander', 'bulbasaur', 'pikachu', 'squirtle']);
  });

  it('moves a Pokémon one step either way (keyboard reorder)', () => {
    expect(swapSlots(team, 1, 2)).toEqual(['pikachu', 'charmander', 'bulbasaur', 'squirtle']);
    expect(swapSlots(team, 3, 2)).toEqual(['pikachu', 'bulbasaur', 'squirtle', 'charmander']);
  });

  it('is symmetric', () => {
    expect(swapSlots(team, 3, 0)).toEqual(swapSlots(team, 0, 3));
  });

  it('never mutates its input', () => {
    const input = [...team];
    swapSlots(input, 0, 3);
    expect(input).toEqual(team);
  });

  it.each([
    [1, 1],
    [-1, 0],
    [0, 4],
    [0.5, 1],
  ])('returns the same team for a no-op or out-of-range move (%d → %d)', (from, to) => {
    expect(swapSlots(team, from, to)).toBe(team);
  });
});
