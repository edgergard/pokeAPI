import { describe, expect, it, vi } from 'vitest';
import { getCreatureArt, getSpecies, type Species } from '@/entities/pokemon';
import { buildFighter, buildTeam, type FighterSpec } from './buildFighter';
import { FALLBACK_MOVE, chooseMove } from './damage';
import type { MovesetData } from './prepare';
import { createRng } from './rng';
import { simulateBattle } from './simulate';
import type { BattleStats } from './types';

const movesets: MovesetData = {
  moves: {
    thunderbolt: ['electric', 90, 100, 'special'],
    'quick-attack': ['normal', 40, 100, 'physical'],
  },
  sets: { pikachu: ['thunderbolt', 'quick-attack'] },
};

const species = (id: number): Species => {
  const s = getSpecies(id);
  if (!s) throw new Error(`no species ${id}`);
  return s;
};

const STATS: BattleStats = {
  hp: 21,
  attack: 12,
  defense: 9,
  specialAttack: 11,
  specialDefense: 11,
  speed: 16,
};

const spec = (over: Partial<FighterSpec> = {}): FighterSpec => ({
  species: species(25),
  level: 5,
  stats: STATS,
  movesets,
  side: 'red',
  slot: 0,
  badges: { stars: 2, talentIcons: ['offense', 'tempo'] },
  ...over,
});

describe('buildFighter', () => {
  it('builds a fighter from a baked species, caller stats and badges', () => {
    const f = buildFighter(spec({ side: 'blue', slot: 2 }));
    expect(f).toEqual({
      id: 'blue-2',
      side: 'blue',
      slot: 2,
      name: 'Pikachu',
      pokemonId: 25,
      types: ['electric'],
      artwork: getCreatureArt(25, 'artwork'),
      level: 5,
      badges: { stars: 2, talentIcons: ['offense', 'tempo'] },
      stats: STATS,
      moves: [
        { name: 'thunderbolt', type: 'electric', power: 90, accuracy: 100, damageClass: 'special' },
        {
          name: 'quick-attack',
          type: 'normal',
          power: 40,
          accuracy: 100,
          damageClass: 'physical',
        },
      ],
    });
  });

  it('uses the caller’s stats as-is (no level maths) and copies them', () => {
    const stats = { ...STATS, attack: 999 };
    const f = buildFighter(spec({ stats, level: 40 }));
    expect(f.stats).toEqual(stats);
    expect(f.stats).not.toBe(stats);
  });

  it('carries talent modifiers only when given', () => {
    const plain = buildFighter(spec());
    expect('critChanceBonus' in plain).toBe(false);
    expect('firstStrike' in plain).toBe(false);
    expect(buildFighter(spec({ critChanceBonus: 5, firstStrike: true }))).toMatchObject({
      critChanceBonus: 5,
      firstStrike: true,
    });
  });

  it('a species without a moveset still fights with the fallback strike', () => {
    const metapod = buildFighter(spec({ species: species(11) }));
    expect(metapod.moves).toEqual([]);
    expect(chooseMove(metapod, buildFighter(spec({ side: 'blue' })), createRng(1))).toBe(
      FALLBACK_MOVE,
    );
  });

  it('never touches the network', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    buildFighter(spec());
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('rejects slots outside 0–3 and non-positive levels', () => {
    expect(() => buildFighter(spec({ slot: 4 }))).toThrow(/slot must be 0–3/);
    expect(() => buildFighter(spec({ slot: -1 }))).toThrow(RangeError);
    expect(() => buildFighter(spec({ level: 0 }))).toThrow(/level/);
  });
});

describe('buildTeam', () => {
  it('slots members in order and the teams battle', () => {
    const member = { species: species(25), level: 5, stats: STATS, badges: spec().badges };
    const red = buildTeam({
      side: 'red',
      trainerName: 'Rowan',
      members: [member, member],
      movesets,
    });
    const blue = buildTeam({
      side: 'blue',
      trainerName: 'Rival',
      members: [member, member],
      movesets,
    });
    expect(red.fighters.map((f) => f.id)).toEqual(['red-0', 'red-1']);
    expect(blue.fighters.map((f) => f.id)).toEqual(['blue-0', 'blue-1']);
    expect(simulateBattle(red, blue, 1).result.reason).toBe('knockout');
  });
});
