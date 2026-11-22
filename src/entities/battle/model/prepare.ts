import type { Pokemon } from '@/entities/pokemon';
import { formatName } from '@/shared/lib/format';
import { BATTLE_LEVEL, statsAtLevel } from './stats';
import type { BattleTeam, Fighter, Move, MoveType, Side } from './types';

export type MovesetData = {
  moves: Record<
    string,
    [type: MoveType, power: number, accuracy: number | null, damageClass: 'physical' | 'special']
  >;
  /** pokemon slug -> move names */
  sets: Record<string, string[]>;
};

export type TeamChoice = { trainerName: string; team: string[] };

/** The damaging moves of a species by its PokeAPI slug (none for an unknown slug: it fights with FALLBACK_MOVE). */
export function movesFor(data: MovesetData, pokemonName: string): Move[] {
  const names = data.sets[pokemonName] ?? [];
  return names.flatMap((name) => {
    const t = data.moves[name];
    return t ? [{ name, type: t[0], power: t[1], accuracy: t[2], damageClass: t[3] }] : [];
  });
}

/**
 * Legacy watch-only battle: a fetched Pokémon at level 50 with no stars or talents.
 * New code builds fighters from baked species with `buildFighter`.
 */
export function toFighter(pokemon: Pokemon, moves: Move[], side: Side, slot: number): Fighter {
  return {
    id: `${side}-${slot}`,
    side,
    slot,
    name: formatName(pokemon.name),
    pokemonId: pokemon.id,
    types: pokemon.types,
    artwork: pokemon.artwork,
    level: BATTLE_LEVEL,
    badges: { stars: 0, talentIcons: [] },
    stats: statsAtLevel(pokemon.stats),
    moves,
  };
}

/** Legacy watch-only battle: fetches a team's Pokémon and turns them into level-50 fighters. */
export async function prepareTeam(
  choice: TeamChoice,
  side: Side,
  fetchPokemon: (name: string) => Promise<Pokemon>,
  data: MovesetData,
): Promise<BattleTeam> {
  const pokemon = await Promise.all(choice.team.map((name) => fetchPokemon(name)));
  return {
    side,
    trainerName: choice.trainerName,
    fighters: pokemon.map((p, slot) => toFighter(p, movesFor(data, p.name), side, slot)),
  };
}
