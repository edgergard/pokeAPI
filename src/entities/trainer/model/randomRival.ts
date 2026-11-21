import type { PokemonListItem } from '@/entities/pokemon';
import { TEAM_SIZE, type Trainer } from './roster';

const FIRST_NAMES = ['Nova', 'Tarin', 'Ela', 'Bram', 'Ilsa', 'Corin', 'Wren', 'Dax'] as const;
const LAST_NAMES = ['Marsh', 'Okoro', 'Lindqvist', 'Vance', 'Ashby', 'Tiernan', 'Rook', 'Fenn'] as const;
/** Pokédex ids at or above this are alternate forms (megas, regionals…). */
const FORM_ID_START = 10000;

const pick = <T>(list: readonly T[], rng: () => number): T => list[Math.floor(rng() * list.length)] as T;

/** A rival with four distinct default-form Pokémon drawn from the index. Throws if fewer than four exist. */
export function randomRival(index: readonly PokemonListItem[], rng: () => number = Math.random): Trainer {
  const pool = index.filter((p) => p.id < FORM_ID_START);
  if (pool.length < TEAM_SIZE) throw new Error('Not enough Pokémon to build a rival team');

  // Partial Fisher–Yates: the first TEAM_SIZE entries end up a uniform distinct sample.
  for (let i = 0; i < TEAM_SIZE; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j] as PokemonListItem, pool[i] as PokemonListItem];
  }

  return {
    id: `rival-${Math.floor(rng() * 1e9).toString(36)}`,
    firstName: pick(FIRST_NAMES, rng),
    lastName: pick(LAST_NAMES, rng),
    team: pool.slice(0, TEAM_SIZE).map((p) => p.name),
    savedAt: new Date().toISOString(),
  };
}
