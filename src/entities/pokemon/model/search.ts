import type { PokemonListItem } from './types';

const normalize = (value: string) => value.toLowerCase().trim().replace(/\s+/g, '-');

/**
 * Ranked search: names starting with the query come first, then names
 * containing it. Already-selected names are excluded.
 */
export function searchPokemon(
  index: readonly PokemonListItem[],
  query: string,
  { exclude = [], limit = 30 }: { exclude?: readonly string[]; limit?: number } = {},
): PokemonListItem[] {
  const q = normalize(query);
  if (!q) return [];

  const excluded = new Set(exclude);
  const prefix: PokemonListItem[] = [];
  const contains: PokemonListItem[] = [];

  for (const item of index) {
    if (excluded.has(item.name)) continue;
    if (item.name.startsWith(q)) prefix.push(item);
    else if (item.name.includes(q)) contains.push(item);
  }

  return [...prefix, ...contains].slice(0, limit);
}
