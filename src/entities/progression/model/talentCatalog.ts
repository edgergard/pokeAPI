import {
  POKEMON_TALENTS,
  TRAINER_TALENTS,
  type PokemonTalent,
  type TalentBranch,
  type TalentEffect,
  type TrainerTalent,
} from './talents';

const pokemonById = new Map(POKEMON_TALENTS.map((t) => [t.id, t]));
const trainerById = new Map(TRAINER_TALENTS.map((t) => [t.id, t]));

export const TALENT_BRANCHES: readonly TalentBranch[] = ['offense', 'defense', 'tempo'];

export function getPokemonTalent(id: string): PokemonTalent | undefined {
  return pokemonById.get(id);
}

export function getTrainerTalent(id: string): TrainerTalent | undefined {
  return trainerById.get(id);
}

/** Pokémon talents of one branch, tier 1 → 4. */
export function pokemonTalentsOfBranch(branch: TalentBranch): PokemonTalent[] {
  return POKEMON_TALENTS.filter((t) => t.branch === branch).sort((a, b) => a.tier - b.tier);
}

/** Branches with at least one learned talent, in branch order (battle badges / talent icons). */
export function learnedTalentBranches(talents: readonly string[]): TalentBranch[] {
  const learned = new Set(talents.map((id) => getPokemonTalent(id)?.branch));
  return TALENT_BRANCHES.filter((b) => learned.has(b));
}

type PercentKind = Exclude<TalentEffect, { kind: 'statPercent' } | { kind: 'firstStrike' }>['kind'];

function sumPercent(effects: readonly TalentEffect[], kind: PercentKind): number {
  let sum = 0;
  for (const effect of effects) {
    if (effect.kind === kind) sum += effect.percent;
  }
  return sum;
}

/** Rule bonuses from learned trainer talents, in percent (unknown ids ignored). */
export type TrainerBonuses = {
  /** Extra Pokémon battle XP. */
  xpPercent: number;
  /** Extra dust from battle and quest rewards. */
  dustPercent: number;
  /** Added to `economy.pokemon.benchXpShare` (as percentage points). */
  benchXpPercent: number;
  /** Chance of a bonus basic capsule on a battle win. */
  capsuleChance: number;
  /** Team-wide critical hit chance. */
  critChance: number;
};

export function trainerBonuses(trainerTalents: readonly string[]): TrainerBonuses {
  const effects = trainerTalents.flatMap((id) => getTrainerTalent(id)?.effects ?? []);
  return {
    xpPercent: sumPercent(effects, 'xpPercent'),
    dustPercent: sumPercent(effects, 'dustPercent'),
    benchXpPercent: sumPercent(effects, 'benchXpPercent'),
    capsuleChance: sumPercent(effects, 'capsuleChance'),
    critChance: sumPercent(effects, 'critChance'),
  };
}

/** Battle-engine modifiers of one Pokémon: its own talents plus team-wide trainer talents. */
export type TalentModifiers = {
  /** Percentage points added to the base critical hit chance. */
  critChance: number;
  /** Acts first in its first turn on the field. */
  firstStrike: boolean;
};

export function talentModifiers(
  owned: { talents: readonly string[] },
  trainerTalents: readonly string[] = [],
): TalentModifiers {
  const effects = owned.talents.flatMap((id) => getPokemonTalent(id)?.effects ?? []);
  return {
    critChance: sumPercent(effects, 'critChance') + trainerBonuses(trainerTalents).critChance,
    firstStrike: effects.some((e) => e.kind === 'firstStrike'),
  };
}
