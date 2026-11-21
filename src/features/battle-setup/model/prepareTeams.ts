import { prepareTeam, type BattleTeam, type MovesetData, type TeamChoice } from '@/entities/battle';
import type { Pokemon } from '@/entities/pokemon';

/**
 * Both battle teams, with the moveset chunk and every Pokémon request in flight at once
 * (a species on both teams is requested once). Rejects with the first failure.
 */
export async function prepareTeams(
  red: TeamChoice,
  blue: TeamChoice,
  fetchPokemon: (name: string) => Promise<Pokemon>,
  loadMovesets: () => Promise<MovesetData>,
): Promise<{ red: BattleTeam; blue: BattleTeam }> {
  const requests = new Map<string, Promise<Pokemon>>();
  for (const name of [...red.team, ...blue.team]) {
    if (!requests.has(name)) requests.set(name, fetchPokemon(name));
  }
  const [data] = await Promise.all([loadMovesets(), Promise.all(requests.values())]);
  const cached = (name: string) => requests.get(name) ?? fetchPokemon(name);
  const [r, b] = await Promise.all([
    prepareTeam(red, 'red', cached, data),
    prepareTeam(blue, 'blue', cached, data),
  ]);
  return { red: r, blue: b };
}
