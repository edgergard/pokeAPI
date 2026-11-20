import { queryOptions, useQueries, useQuery } from '@tanstack/react-query';
import { fetchPokemon, fetchPokemonIndex } from './pokemonApi';

export const pokemonKeys = {
  all: ['pokemon'] as const,
  index: () => [...pokemonKeys.all, 'index'] as const,
  detail: (name: string) => [...pokemonKeys.all, 'detail', name] as const,
};

export const pokemonIndexQuery = () =>
  queryOptions({
    queryKey: pokemonKeys.index(),
    queryFn: ({ signal }) => fetchPokemonIndex(signal),
    staleTime: Infinity,
    gcTime: Infinity,
  });

export const pokemonQuery = (name: string) =>
  queryOptions({
    queryKey: pokemonKeys.detail(name),
    queryFn: ({ signal }) => fetchPokemon(name, signal),
    staleTime: Infinity,
  });

export const usePokemonIndex = () => useQuery(pokemonIndexQuery());

/** Fetches several Pokémon in parallel; each one is cached individually. */
export function usePokemonList(names: readonly string[]) {
  return useQueries({
    queries: names.map((name) => pokemonQuery(name)),
    combine: (results) => ({
      data: results.map((r) => r.data),
      statuses: results.map((r) => r.status),
      isPending: results.some((r) => r.isPending),
      isError: results.some((r) => r.isError),
      refetch: () => results.forEach((r) => r.isError && r.refetch()),
    }),
  });
}
