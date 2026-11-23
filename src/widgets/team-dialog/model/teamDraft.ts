import { getSpecies, type Species } from '@/entities/pokemon';
import type { OwnedPokemon, Save } from '@/entities/save';

type Collection = Save['collection'];

/** The team being edited: species ids in slot order, no gaps (filled slots first). */
export type Draft = readonly number[];

/** The saved team as a draft: owned ids only, no repeats, at most `slots`. */
export function initialDraft(
  team: readonly number[],
  collection: Collection,
  slots: number,
): number[] {
  const seen = new Set<number>();
  const out: number[] = [];
  for (const id of team) {
    if (seen.has(id) || !collection[String(id)]) continue;
    seen.add(id);
    out.push(id);
  }
  return out.slice(0, Math.max(0, slots));
}

/** Swaps two filled slots (0-based); out-of-range indexes leave the draft as it is. */
export function swapSlots(draft: Draft, a: number, b: number): number[] {
  const next = [...draft];
  const first = next[a];
  const second = next[b];
  if (first === undefined || second === undefined || a === b) return next;
  next[a] = second;
  next[b] = first;
  return next;
}

/** Removes the Pokémon in slot `index`; the slots after it move up. */
export function removeAt(draft: Draft, index: number): number[] {
  return draft.filter((_, i) => i !== index);
}

export type AddResult =
  { ok: true; draft: number[]; slot: number } | { ok: false; reason: 'full' | 'inTeam' };

/**
 * Puts `id` in the team: into `target` (0-based, a filled slot to replace) when given, otherwise
 * the first empty slot. Refused when it is already in the team or every open slot is taken.
 */
export function addToDraft(
  draft: Draft,
  id: number,
  slots: number,
  target: number | null = null,
): AddResult {
  if (draft.includes(id)) return { ok: false, reason: 'inTeam' };
  if (target !== null && target >= 0 && target < draft.length) {
    const next = [...draft];
    next[target] = id;
    return { ok: true, draft: next, slot: target };
  }
  if (draft.length >= slots) return { ok: false, reason: 'full' };
  return { ok: true, draft: [...draft, id], slot: draft.length };
}

export type SortKey = 'level' | 'name';

export type RosterRow = { owned: OwnedPokemon; species: Species };

/**
 * Owned Pokémon for the picker: filtered by name (case-insensitive substring), sorted by level
 * (highest first) or name; ties by species id. Unknown species are skipped.
 */
export function rosterRows(
  collection: Collection,
  { filter, sort }: { filter: string; sort: SortKey },
): RosterRow[] {
  const query = filter.trim().toLowerCase();
  const rows: RosterRow[] = [];
  for (const owned of Object.values(collection)) {
    const species = getSpecies(owned.speciesId);
    if (!species) continue;
    if (query && !species.name.toLowerCase().includes(query)) continue;
    rows.push({ owned, species });
  }
  return rows.sort((a, b) =>
    sort === 'level'
      ? b.owned.level - a.owned.level || a.species.id - b.species.id
      : a.species.name.localeCompare(b.species.name) || a.species.id - b.species.id,
  );
}

/** Display name of a species id ("#25" when unknown). */
export const speciesName = (id: number): string => getSpecies(id)?.name ?? `#${id}`;

/** "Pikachu moved to slot 2 of 3. Bulbasaur is now in slot 1." */
export function swapAnnouncement(draft: Draft, from: number, to: number, slots: number): string {
  const moved = draft[from];
  const displaced = draft[to];
  if (moved === undefined || displaced === undefined) return '';
  return `${speciesName(moved)} moved to slot ${to + 1} of ${slots}. ${speciesName(displaced)} is now in slot ${from + 1}.`;
}

/** Same ids in the same order. */
export const sameTeam = (a: readonly number[], b: readonly number[]): boolean =>
  a.length === b.length && a.every((id, i) => id === b[i]);
