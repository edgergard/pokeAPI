import type { PokemonType } from '@/entities/pokemon';
import type { Move } from './types';

/** Damaging moves only: STAB first, then higher power, then name; at most `max`. */
export function selectMoves(candidates: readonly Move[], pokemonTypes: readonly PokemonType[], max = 4): Move[] {
  const isStab = (m: Move) => m.type !== 'typeless' && pokemonTypes.includes(m.type);
  return candidates
    .filter((m) => m.power > 0)
    .sort((a, b) =>
      Number(isStab(b)) - Number(isStab(a)) || b.power - a.power || a.name.localeCompare(b.name))
    .slice(0, max);
}
