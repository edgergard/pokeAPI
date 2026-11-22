import { describe, expect, it } from 'vitest';
import { idFromUrl, toPokemon } from './mappers';
import { searchPokemon } from './search';
import type { PokemonResponse } from './types';

describe('idFromUrl', () => {
  it('extracts the trailing numeric id', () => {
    expect(idFromUrl('https://pokeapi.co/api/v2/pokemon/25/')).toBe(25);
    expect(idFromUrl('https://pokeapi.co/api/v2/pokemon/10001')).toBe(10001);
  });
});

describe('toPokemon', () => {
  const dto: PokemonResponse = {
    id: 6,
    name: 'charizard',
    base_experience: 267,
    height: 17,
    weight: 905,
    types: [
      { slot: 2, type: { name: 'flying', url: '' } },
      { slot: 1, type: { name: 'fire', url: '' } },
    ],
    stats: [
      { base_stat: 78, stat: { name: 'hp', url: '' } },
      { base_stat: 84, stat: { name: 'attack', url: '' } },
      { base_stat: 78, stat: { name: 'defense', url: '' } },
      { base_stat: 109, stat: { name: 'special-attack', url: '' } },
      { base_stat: 85, stat: { name: 'special-defense', url: '' } },
      { base_stat: 100, stat: { name: 'speed', url: '' } },
    ],
    sprites: {
      front_default: 'sprite.png',
      other: { 'official-artwork': { front_default: 'art.png' } },
    },
  };

  it('maps stats by name rather than by array position', () => {
    const pokemon = toPokemon({ ...dto, stats: [...dto.stats].reverse() });
    expect(pokemon.stats.speed).toBe(100);
    expect(pokemon.stats.hp).toBe(78);
    expect(pokemon.totalStats).toBe(534);
  });

  it('orders types by slot and converts units', () => {
    const pokemon = toPokemon(dto);
    expect(pokemon.types).toEqual(['fire', 'flying']);
    expect(pokemon.height).toBe(1.7);
    expect(pokemon.weight).toBe(90.5);
    expect(pokemon.artwork).toBe('art.png');
  });

  it('falls back to the default sprite when artwork is missing', () => {
    expect(toPokemon({ ...dto, sprites: { front_default: 'sprite.png' } }).artwork).toBe(
      'sprite.png',
    );
  });
});

describe('searchPokemon', () => {
  const index = ['pikachu', 'raichu', 'pichu', 'charmander', 'chikorita'].map((name, i) => ({
    name,
    id: i + 1,
  }));

  it('returns nothing for an empty query', () => {
    expect(searchPokemon(index, '   ')).toEqual([]);
  });

  it('ranks prefix matches before substring matches', () => {
    expect(searchPokemon(index, 'chu').map((p) => p.name)).toEqual(['pikachu', 'raichu', 'pichu']);
    expect(searchPokemon(index, 'pi').map((p) => p.name)).toEqual(['pikachu', 'pichu']);
  });

  it('is case-insensitive and excludes picked names', () => {
    expect(searchPokemon(index, 'PI', { exclude: ['pikachu'] }).map((p) => p.name)).toEqual([
      'pichu',
    ]);
  });
});
