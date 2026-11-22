import { isOwned, rarityRank } from '@/entities/capsule';
import { allSpecies, type PokemonType, type Species } from '@/entities/pokemon';
import type { Save } from '@/entities/save';
import { matchesSpeciesQuery, type SearchMode } from '@/features/pokemon-search';
import { RARITIES, type Rarity } from '@/shared/config/economy';

export type Ownership = 'all' | 'owned' | 'missing';
export type SortKey = 'dex' | 'level' | 'rarity';

export type CollectionFilters = {
  ownership: Ownership;
  type: PokemonType | 'all';
  rarity: Rarity | 'all';
  generation: number | 'all';
  /** Search text (name or dex number), matched like PokemonSearch. */
  query: string;
};

export const DEFAULT_FILTERS: CollectionFilters = {
  ownership: 'all',
  type: 'all',
  rarity: 'all',
  generation: 'all',
  query: '',
};

export const OWNERSHIP_OPTIONS: readonly { value: Ownership; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'owned', label: 'Owned' },
  { value: 'missing', label: 'Missing' },
];

export const SORT_OPTIONS: readonly { value: SortKey; label: string }[] = [
  { value: 'dex', label: 'Dex number' },
  { value: 'level', label: 'Level' },
  { value: 'rarity', label: 'Rarity' },
];

/** The 18 types present in the baked species data, alphabetically. */
export const SPECIES_TYPES: readonly PokemonType[] = [
  ...new Set(allSpecies.flatMap((s) => s.types)),
].sort();

/** Generations present in the baked species data, in order. */
export const SPECIES_GENERATIONS: readonly number[] = [
  ...new Set(allSpecies.map((s) => s.generation)),
].sort((a, b) => a - b);

export const isRarity = (value: string): value is Rarity =>
  (RARITIES as readonly string[]).includes(value);

export const isPokemonType = (value: string): value is PokemonType =>
  (SPECIES_TYPES as readonly string[]).includes(value);

/** The PokemonSearch mode that matches the ownership filter (suggestions agree with the grid). */
export function searchModeFor(ownership: Ownership): SearchMode {
  return ownership === 'missing' ? 'unowned' : ownership;
}

/** True when any filter (not the sort) narrows the grid. */
export function hasActiveFilters(filters: CollectionFilters): boolean {
  return (
    filters.ownership !== 'all' ||
    filters.type !== 'all' ||
    filters.rarity !== 'all' ||
    filters.generation !== 'all' ||
    filters.query.trim() !== ''
  );
}

export function filterSpecies(
  species: readonly Species[],
  collection: Save['collection'],
  filters: CollectionFilters,
): Species[] {
  return species.filter((s) => {
    if (filters.ownership !== 'all') {
      const owned = isOwned({ collection }, s.id);
      if (filters.ownership === 'owned' ? !owned : owned) return false;
    }
    if (filters.type !== 'all' && !s.types.includes(filters.type)) return false;
    if (filters.rarity !== 'all' && s.rarity !== filters.rarity) return false;
    if (filters.generation !== 'all' && s.generation !== filters.generation) return false;
    return matchesSpeciesQuery(s, filters.query);
  });
}

/**
 * Orders the grid. `dex`: by number. `level`: owned Pokémon by level, then stars (highest first),
 * missing ones after them. `rarity`: rarest first. Ties fall back to the dex number.
 */
export function sortSpecies(
  species: readonly Species[],
  collection: Save['collection'],
  sort: SortKey,
): Species[] {
  const byDex = (a: Species, b: Species) => a.id - b.id;
  if (sort === 'dex') return [...species].sort(byDex);
  if (sort === 'rarity') {
    return [...species].sort((a, b) => rarityRank(b.rarity) - rarityRank(a.rarity) || byDex(a, b));
  }
  const level = (s: Species) => collection[String(s.id)]?.level ?? 0;
  const stars = (s: Species) => collection[String(s.id)]?.stars ?? 0;
  return [...species].sort((a, b) => level(b) - level(a) || stars(b) - stars(a) || byDex(a, b));
}

/** Owned species that exist in the baked data ("Collection N / 1025"). */
export function ownedCount(collection: Save['collection']): number {
  return allSpecies.reduce((n, s) => n + (isOwned({ collection }, s.id) ? 1 : 0), 0);
}
