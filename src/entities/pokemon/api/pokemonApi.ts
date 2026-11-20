import { getJson } from '@/shared/api/http';
import { toListItem, toPokemon } from '../model/mappers';
import type { Pokemon, PokemonListItem, PokemonListResponse, PokemonResponse } from '../model/types';

const BASE_URL = 'https://pokeapi.co/api/v2';

export async function fetchPokemonIndex(signal?: AbortSignal): Promise<PokemonListItem[]> {
  const data = await getJson<PokemonListResponse>(`${BASE_URL}/pokemon?limit=100000`, signal);
  return data.results.map(toListItem);
}

export async function fetchPokemon(name: string, signal?: AbortSignal): Promise<Pokemon> {
  const data = await getJson<PokemonResponse>(`${BASE_URL}/pokemon/${encodeURIComponent(name)}`, signal);
  return toPokemon(data);
}
