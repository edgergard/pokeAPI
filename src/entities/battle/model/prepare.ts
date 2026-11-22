import type { Pokemon } from '@/entities/pokemon';
import { statsAtLevel } from './stats';
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

export function movesFor(data: MovesetData, pokemonName: string): Move[] {
  const names = data.sets[pokemonName] ?? [];
  return names.flatMap((name) => {
    const t = data.moves[name];
    return t ? [{ name, type: t[0], power: t[1], accuracy: t[2], damageClass: t[3] }] : [];
  });
}

export function toFighter(pokemon: Pokemon, moves: Move[], side: Side, slot: number): Fighter {
  return {
    id: `${side}-${slot}`,
    side,
    slot,
    name: pokemon.name,
    pokemonId: pokemon.id,
    types: pokemon.types,
    artwork: pokemon.artwork,
    stats: statsAtLevel(pokemon.stats),
    moves,
  };
}

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
