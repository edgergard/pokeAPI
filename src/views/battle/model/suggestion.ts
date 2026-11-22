import { getSpecies } from '@/entities/pokemon';
import { talentPointsAvailable } from '@/entities/progression';
import type { Save } from '@/entities/save';
import type { QuestKind } from '@/shared/config/economy';

/** The one hint a defeat shows (design.md flow `loop` step 4). */
export type LossSuggestion =
  | { kind: 'bench'; speciesId: number; name: string; level: number }
  | { kind: 'talent'; speciesId: number; name: string; points: number };

/**
 * A bench Pokémon above the weakest team member's level ("Bulbasaur is Lv 12 on the bench → Put
 * in team"), else the team member with the most unspent talent points ("Spend 1 talent point").
 * Null when neither applies.
 */
export function lossSuggestion(save: Pick<Save, 'collection' | 'team'>): LossSuggestion | null {
  const team = save.team.flatMap((id) => {
    const owned = save.collection[String(id)];
    return owned ? [owned] : [];
  });
  if (team.length === 0) return null;
  const weakest = Math.min(...team.map((p) => p.level));
  const inTeam = new Set(save.team);
  const bench = Object.values(save.collection)
    .filter((p) => !inTeam.has(p.speciesId) && p.level > weakest)
    .sort((a, b) => b.level - a.level || a.speciesId - b.speciesId)[0];
  if (bench) {
    return {
      kind: 'bench',
      speciesId: bench.speciesId,
      name: getSpecies(bench.speciesId)?.name ?? `#${bench.speciesId}`,
      level: bench.level,
    };
  }
  const talent = team
    .map((p) => ({ p, points: talentPointsAvailable(p) }))
    .filter((x) => x.points > 0)
    .sort((a, b) => b.points - a.points || a.p.speciesId - b.p.speciesId)[0];
  if (talent) {
    return {
      kind: 'talent',
      speciesId: talent.p.speciesId,
      name: getSpecies(talent.p.speciesId)?.name ?? `#${talent.p.speciesId}`,
      points: talent.points,
    };
  }
  return null;
}

/** Quest names for the result's quest ticks ("Win 3 battles"). */
export function questLabel(kind: QuestKind, target: number): string {
  const plural = (word: string) => `${target} ${word}${target === 1 ? '' : 's'}`;
  switch (kind) {
    case 'battleWon':
      return `Win ${plural('battle')}`;
    case 'capsuleOpened':
      return `Open ${plural('capsule')}`;
    case 'damageDealt':
      return `Deal ${target.toLocaleString('en-US')} damage`;
    case 'stageCleared':
      return `Clear ${plural('ladder stage')}`;
    case 'pokemonLeveled':
      return `Level up Pokémon ${target} time${target === 1 ? '' : 's'}`;
  }
}

/** The result screen's one-phrase announcement (design.md: "Victory. 1 capsule earned."). */
export function resultPhrase(
  outcome: { won: boolean; capsules: number; trainerLevel: number | null } | null,
): string {
  if (!outcome) return '';
  if (!outcome.won) return 'Defeated. Try a stronger lineup.';
  const n = outcome.capsules;
  const capsules = n > 0 ? ` ${n} capsule${n === 1 ? '' : 's'} earned.` : '';
  const level = outcome.trainerLevel !== null ? ` Trainer Lv ${outcome.trainerLevel}.` : '';
  return `Victory.${capsules}${level}`;
}
