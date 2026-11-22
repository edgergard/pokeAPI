import type { OwnedPokemon, Save } from '@/entities/save';
import { nextPokemonTalentPointLevel, talentPointsAvailable } from './pokemonLevel';
import { getPokemonTalent, getTrainerTalent, pokemonTalentsOfBranch } from './talentCatalog';
import { nextTrainerTalentPointLevel } from './trainerLevel';

/**
 * Why a Pokémon talent can't be learned. UI copy:
 * - `noPoints`: "First talent point at Lv 5" (no talents yet) / "Next point at Lv 10"; `nextPointAt` null = max level
 * - `requiresTier`: "Requires: <name of the `requires` talent>" (previous tier of the same branch)
 */
export type PokemonTalentBlock =
  | { reason: 'unknownTalent' }
  | { reason: 'alreadyLearned' }
  | { reason: 'requiresTier'; requires: string }
  | { reason: 'noPoints'; nextPointAt: number | null };

export type LearnPokemonTalentResult =
  { ok: true; owned: OwnedPokemon } | ({ ok: false } & PokemonTalentBlock);

function pokemonTalentBlock(
  owned: Pick<OwnedPokemon, 'level' | 'talents'>,
  talentId: string,
): PokemonTalentBlock | null {
  const talent = getPokemonTalent(talentId);
  if (!talent) return { reason: 'unknownTalent' };
  if (owned.talents.includes(talentId)) return { reason: 'alreadyLearned' };
  const previous = pokemonTalentsOfBranch(talent.branch).find((t) => t.tier === talent.tier - 1);
  if (previous && !owned.talents.includes(previous.id)) {
    return { reason: 'requiresTier', requires: previous.id };
  }
  if (talentPointsAvailable(owned) < 1) {
    return { reason: 'noPoints', nextPointAt: nextPokemonTalentPointLevel(owned.level) };
  }
  return null;
}

/** Learns a Pokémon talent: id exists, not learned yet, previous tier of the branch learned, a free point. */
export function learnPokemonTalent(
  owned: OwnedPokemon,
  talentId: string,
): LearnPokemonTalentResult {
  const block = pokemonTalentBlock(owned, talentId);
  if (block) return { ok: false, ...block };
  return { ok: true, owned: { ...owned, talents: [...owned.talents, talentId] } };
}

/** Free respec: clears every learned talent (points are derived from the level, so all come back). */
export function resetPokemonTalents(owned: OwnedPokemon): OwnedPokemon {
  if (owned.talents.length === 0) return owned;
  return { ...owned, talents: [] };
}

export type TalentNodeState<Block> =
  { state: 'learned' } | { state: 'available' } | ({ state: 'locked' } & Block);

/** Talent tree node state for the creature screen (`aria-pressed` / `aria-disabled` + reason). */
export function pokemonTalentNodeState(
  owned: Pick<OwnedPokemon, 'level' | 'talents'>,
  talentId: string,
): TalentNodeState<Exclude<PokemonTalentBlock, { reason: 'alreadyLearned' }>> {
  if (owned.talents.includes(talentId)) return { state: 'learned' };
  const block = pokemonTalentBlock(owned, talentId);
  if (!block || block.reason === 'alreadyLearned') return { state: 'available' };
  return { state: 'locked', ...block };
}

/**
 * Why a trainer talent can't be learned. UI copy:
 * - `requiresLevel`: "Requires Trainer Lv 6"
 * - `requiresTalents`: "Requires: Quick Draw" (`missing` ids, in definition order)
 * - `noPoints`: "Next point at Lv 9" (`nextPointAt` null = max level)
 */
export type TrainerTalentBlock =
  | { reason: 'unknownTalent' }
  | { reason: 'alreadyLearned' }
  | { reason: 'requiresLevel'; level: number }
  | { reason: 'requiresTalents'; missing: string[] }
  | { reason: 'noPoints'; nextPointAt: number | null };

export type LearnTrainerTalentResult =
  { ok: true; save: Save } | ({ ok: false } & TrainerTalentBlock);

function trainerTalentBlock(trainer: Save['trainer'], talentId: string): TrainerTalentBlock | null {
  const talent = getTrainerTalent(talentId);
  if (!talent) return { reason: 'unknownTalent' };
  if (trainer.talents.includes(talentId)) return { reason: 'alreadyLearned' };
  if (trainer.level < talent.requiresLevel) {
    return { reason: 'requiresLevel', level: talent.requiresLevel };
  }
  const missing = talent.requires.filter((id) => !trainer.talents.includes(id));
  if (missing.length > 0) return { reason: 'requiresTalents', missing };
  if (trainer.talentPoints < 1) {
    return { reason: 'noPoints', nextPointAt: nextTrainerTalentPointLevel(trainer.level) };
  }
  return null;
}

/** Learns a trainer talent: id exists, not learned, trainer level, every prerequisite, a free point. */
export function learnTrainerTalent(save: Save, talentId: string): LearnTrainerTalentResult {
  const block = trainerTalentBlock(save.trainer, talentId);
  if (block) return { ok: false, ...block };
  return {
    ok: true,
    save: {
      ...save,
      trainer: {
        ...save.trainer,
        talentPoints: save.trainer.talentPoints - 1,
        talents: [...save.trainer.talents, talentId],
      },
    },
  };
}

/** Free respec of the trainer tree: refunds one point per learned talent. */
export function resetTrainerTalents(save: Save): Save {
  if (save.trainer.talents.length === 0) return save;
  return {
    ...save,
    trainer: {
      ...save.trainer,
      talentPoints: save.trainer.talentPoints + save.trainer.talents.length,
      talents: [],
    },
  };
}

/** Trainer tree node state for the trainer screen (locked / available / owned + reason). */
export function trainerTalentNodeState(
  save: Pick<Save, 'trainer'>,
  talentId: string,
): TalentNodeState<Exclude<TrainerTalentBlock, { reason: 'alreadyLearned' }>> {
  if (save.trainer.talents.includes(talentId)) return { state: 'learned' };
  const block = trainerTalentBlock(save.trainer, talentId);
  if (!block || block.reason === 'alreadyLearned') return { state: 'available' };
  return { state: 'locked', ...block };
}
