import { statsAtLevel } from '@/entities/battle';
import { getSpecies, type StatKey } from '@/entities/pokemon';
import { computeStats } from '@/entities/progression';
import type { OwnedPokemon, Save } from '@/entities/save';

/** Battle stats in the shape both `computeStats` and the engine's `statsAtLevel` return. */
export type StatBlock = Readonly<Record<StatKey, number>>;

/** One fighter's power: the sum of its six battle stats. */
export function statPower(stats: StatBlock): number {
  return (
    stats.hp +
    stats.attack +
    stats.defense +
    stats.specialAttack +
    stats.specialDefense +
    stats.speed
  );
}

/**
 * Team power ("Recommended power vs yours"): the sum of every member's battle stats. The same
 * function rates a rival lineup and the player's team.
 */
export function teamPower(members: readonly StatBlock[]): number {
  return members.reduce((sum, stats) => sum + statPower(stats), 0);
}

/**
 * Battle stats of a rival member. Rivals are not owned: IV 31, no nature, no talents — the
 * engine's `statsAtLevel`. Null for an unknown species.
 */
export function rivalStats(member: { speciesId: number; level: number }): StatBlock | null {
  const species = getSpecies(member.speciesId);
  return species ? statsAtLevel(species.stats, member.level) : null;
}

/** Battle stats of an owned Pokémon (level, IVs, nature, talents). Null for an unknown species. */
export function ownedStats(owned: OwnedPokemon): StatBlock | null {
  const species = getSpecies(owned.speciesId);
  return species ? computeStats(species, owned) : null;
}

/** Power of one owned Pokémon (0 for an unknown species). */
export function ownedPower(owned: OwnedPokemon): number {
  const stats = ownedStats(owned);
  return stats ? statPower(stats) : 0;
}

/** Power of the given team (species ids) from the collection; ids not owned count 0. */
export function collectionTeamPower(
  collection: Save['collection'],
  ids: readonly number[],
): number {
  return teamPower(
    ids.flatMap((id) => {
      const owned = collection[String(id)];
      const stats = owned ? ownedStats(owned) : null;
      return stats ? [stats] : [];
    }),
  );
}

/**
 * "Auto-fill strongest": the `slots` most powerful owned Pokémon, strongest first. Ties go to the
 * higher level, then the lower species id, so the pick is stable.
 */
export function strongestTeam(collection: Save['collection'], slots: number): number[] {
  return Object.values(collection)
    .map((owned) => ({ owned, power: ownedPower(owned) }))
    .sort(
      (a, b) =>
        b.power - a.power || b.owned.level - a.owned.level || a.owned.speciesId - b.owned.speciesId,
    )
    .slice(0, Math.max(0, slots))
    .map(({ owned }) => owned.speciesId);
}
