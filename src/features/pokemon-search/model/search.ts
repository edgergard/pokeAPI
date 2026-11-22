import { isOwned } from '@/entities/capsule';
import { allSpecies, type Species } from '@/entities/pokemon';
import type { Save } from '@/entities/save';

/** Which species a search covers: the ones in the collection, the missing ones, or every species. */
export type SearchMode = 'owned' | 'unowned' | 'all';

/** Lower-case, trimmed, accents stripped ("Flabébé " → "flabebe"). */
export function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const nameKeys = new Map<number, string>();

/** The species name as `normalizeQuery` would turn it (memoised: 1025 species, every keystroke). */
function nameKey(species: Species): string {
  let key = nameKeys.get(species.id);
  if (key === undefined) {
    key = normalizeQuery(species.name);
    nameKeys.set(species.id, key);
  }
  return key;
}

/** "25" / "#025" → 25; anything else → null. */
function dexNumber(normalized: string): number | null {
  if (!/^#?\d+$/.test(normalized)) return null;
  return Number(normalized.replace('#', ''));
}

/**
 * Whether a species matches a search: its dex number ("25", "#025") or part of its name (case and
 * accents ignored). An empty query matches every species.
 */
export function matchesSpeciesQuery(species: Species, query: string): boolean {
  const q = normalizeQuery(query);
  if (!q) return true;
  const number = dexNumber(q);
  if (number !== null) return species.id === number;
  return nameKey(species).includes(q) || species.slug.includes(q);
}

/** Whether a species belongs to a search mode, given the player's collection. */
export function inSearchMode(
  collection: Save['collection'],
  speciesId: number,
  mode: SearchMode,
): boolean {
  if (mode === 'all') return true;
  const owned = isOwned({ collection }, speciesId);
  return mode === 'owned' ? owned : !owned;
}

/**
 * Owned species that exist in the baked data ("Collection N / 1025"). Keys outside the species list
 * (e.g. from an older data bake) don't count, so N never exceeds SPECIES_COUNT. Shared by every screen
 * that shows the collection count.
 */
export function ownedSpeciesCount(collection: Save['collection']): number {
  return allSpecies.reduce((n, s) => n + (isOwned({ collection }, s.id) ? 1 : 0), 0);
}

type SearchOptions = {
  mode: SearchMode;
  collection: Save['collection'];
  /** Species ids to leave out (e.g. Pokémon already in a team). */
  exclude?: readonly number[];
  /** Searched list (defaults to every baked species). */
  species?: readonly Species[];
};

/**
 * Species matching `query` in the given mode, best first: names that start with the query, then names
 * that contain it, each by dex number. An empty query returns nothing (nothing to suggest yet).
 */
export function searchSpecies(query: string, options: SearchOptions): Species[] {
  const q = normalizeQuery(query);
  if (!q) return [];
  const { mode, collection, exclude = [], species = allSpecies } = options;
  const excluded = new Set(exclude);
  const found = species.filter(
    (s) => !excluded.has(s.id) && inSearchMode(collection, s.id, mode) && matchesSpeciesQuery(s, q),
  );
  if (dexNumber(q) !== null) return found;
  const starts = (s: Species) => (nameKey(s).startsWith(q) || s.slug.startsWith(q) ? 0 : 1);
  return found.sort((a, b) => starts(a) - starts(b) || a.id - b.id);
}
