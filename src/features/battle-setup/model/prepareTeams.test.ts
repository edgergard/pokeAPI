import { describe, expect, it, vi } from 'vitest';
import type { MovesetData } from '@/entities/battle';
import type { Pokemon } from '@/entities/pokemon';
import { prepareTeams } from './prepareTeams';

const mon = (name: string): Pokemon => ({
  id: name.length,
  name,
  types: ['normal'],
  artwork: null,
  sprite: null,
  baseExperience: null,
  height: 1,
  weight: 1,
  stats: { hp: 50, attack: 50, defense: 50, specialAttack: 50, specialDefense: 50, speed: 50 },
  totalStats: 300,
});

const EMPTY: MovesetData = { moves: {}, sets: {} };

describe('prepareTeams', () => {
  it('fetches both teams while the movesets are still loading', async () => {
    let resolveMovesets: (d: MovesetData) => void = () => undefined;
    const load = vi.fn(() => new Promise<MovesetData>((r) => { resolveMovesets = r; }));
    const fetchPokemon = vi.fn(async (name: string) => mon(name));

    const done = prepareTeams(
      { trainerName: 'Ash', team: ['pikachu', 'eevee'] },
      { trainerName: 'Mira', team: ['gengar', 'pikachu'] },
      fetchPokemon,
      load,
    );
    // Every fetch has started before the moveset data arrives (a shared species is fetched once).
    expect(fetchPokemon.mock.calls.map(([n]) => n).sort()).toEqual(['eevee', 'gengar', 'pikachu']);
    resolveMovesets(EMPTY);
    const { red, blue } = await done;
    expect(red.trainerName).toBe('Ash');
    expect(red.fighters.map((f) => f.name)).toEqual(['pikachu', 'eevee']);
    expect(blue.fighters.map((f) => f.id)).toEqual(['blue-0', 'blue-1']);
  });

  it('rejects when any request fails', async () => {
    const fetchPokemon = vi.fn(async (name: string) => {
      if (name === 'nope') throw new Error('404');
      return mon(name);
    });
    await expect(
      prepareTeams({ trainerName: 'A', team: ['nope'] }, { trainerName: 'B', team: ['eevee'] }, fetchPokemon, async () => EMPTY),
    ).rejects.toThrow('404');
  });
});
