import { describe, expect, it } from 'vitest';
import type { Pokemon } from '@/entities/pokemon';
import { selectMoves } from './selectMoves';
import { movesFor, prepareTeam, toFighter, type MovesetData } from './prepare';
import { loadMovesets } from '../api/movesets';
import { statsAtLevel } from './stats';
import type { Move, MoveType } from './types';

const m = (name: string, type: MoveType, power: number): Move => ({
  name,
  type,
  power,
  accuracy: 100,
  damageClass: 'special',
});

const lapras: Pokemon = {
  id: 131,
  name: 'lapras',
  types: ['water', 'ice'],
  artwork: 'a.png',
  sprite: 's.png',
  baseExperience: 187,
  height: 25,
  weight: 2200,
  totalStats: 535,
  stats: { hp: 130, attack: 85, defense: 80, specialAttack: 85, specialDefense: 95, speed: 60 },
};

const data = {
  moves: { surf: ['water', 90, 100, 'special'] },
  sets: { lapras: ['surf'] },
} as MovesetData;

describe('selectMoves', () => {
  it('prefers STAB, then power, then name, damaging only, max 4', () => {
    const picked = selectMoves(
      [
        m('growl', 'normal', 0),
        m('surf', 'water', 90),
        m('thunderbolt', 'electric', 90),
        m('thunder', 'electric', 110),
        m('quick-attack', 'normal', 40),
        m('spark', 'electric', 65),
        m('slam', 'normal', 80),
      ],
      ['electric'],
    );
    expect(picked.map((x) => x.name)).toEqual(['thunder', 'thunderbolt', 'spark', 'surf']);
  });
});

describe('movesFor', () => {
  it('returns [] for unknown species and decodes tuples', () => {
    expect(movesFor(data, 'lapras')).toEqual([
      { name: 'surf', type: 'water', power: 90, accuracy: 100, damageClass: 'special' },
    ]);
    expect(movesFor(data, 'brand-new-mon')).toEqual([]);
  });
});

describe('toFighter', () => {
  it('builds level-50 stats and side/slot id', () => {
    const moves = movesFor(data, 'lapras');
    const f = toFighter(lapras, moves, 'blue', 2);
    expect(f).toMatchObject({
      id: 'blue-2',
      side: 'blue',
      slot: 2,
      name: 'lapras',
      pokemonId: 131,
      types: ['water', 'ice'],
      artwork: 'a.png',
      moves,
    });
    expect(f.stats).toEqual(statsAtLevel(lapras.stats));
  });
});

describe('prepareTeam', () => {
  it('fetches each member and keeps order', async () => {
    const team = await prepareTeam(
      { trainerName: 'Ash', team: ['lapras', 'lapras'] },
      'red',
      async () => lapras,
      data,
    );
    expect(team.trainerName).toBe('Ash');
    expect(team.side).toBe('red');
    expect(team.fighters.map((f) => f.id)).toEqual(['red-0', 'red-1']);
  });
});

describe('committed movesets.json', () => {
  it('covers every default-form Pokémon with ≤ 4 moves', async () => {
    const d = await loadMovesets();
    expect(Object.keys(d.sets).length).toBeGreaterThanOrEqual(1000);
    expect(Object.values(d.sets).every((s) => s.length <= 4 && s.every((n) => n in d.moves))).toBe(
      true,
    );
  });
});
