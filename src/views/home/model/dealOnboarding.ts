import {
  buildTeam,
  findIntroSeed,
  IntroSeedError,
  movesFor,
  statsAtLevel,
  type BattleTeam,
  type MovesetData,
  type TeamMemberSpec,
} from '@/entities/battle';
import { speciesOfRarity, type Species } from '@/entities/pokemon';
import type { Save } from '@/entities/save';
import { economy } from '@/shared/config/economy';
import { createRng, hashSeed } from '@/shared/lib/rng';

/**
 * How many rivals the deal tries (k = 0 … limit − 1) before giving up. A search bound, not a game
 * number: each try is one `findIntroSeed` scan (a few ms). Stream 2-play's intro uses the same loop.
 */
export const RIVAL_PICK_LIMIT = 32;

/** Name on the rival side of the intro battle (the simulation never reads it). */
export const INTRO_RIVAL_NAME = 'Rival';

/** No loaner or no winnable rival could be dealt (never expected with the baked data). */
export class OnboardingDealError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OnboardingDealError';
  }
}

export type OnboardingDeal = {
  loanerSpeciesId: number;
  rivalSpeciesId: number;
  /** The `findIntroSeed` result for these two (2-play recomputes it from the same teams). */
  introSeed: number;
  /** The `k` of `hashSeed(seed, 'rival', k)` that gave the rival. */
  rivalPick: number;
};

const hasMoves = (movesets: MovesetData) => (species: Species) =>
  movesFor(movesets, species.slug).length > 0;

/** Loaner candidates: common + uncommon species (in `speciesOfRarity` order) that have moves. */
export function loanerPool(movesets: MovesetData): Species[] {
  return [...speciesOfRarity('common'), ...speciesOfRarity('uncommon')].filter(hasMoves(movesets));
}

/** The loaner of a save seed: one draw of `createRng(hashSeed(seed, 'loaner'))` over `loanerPool`. */
export function pickLoaner(seed: number, movesets: MovesetData): Species {
  const pool = loanerPool(movesets);
  const loaner = pool[Math.floor(createRng(hashSeed(seed, 'loaner'))() * pool.length)];
  if (!loaner)
    throw new OnboardingDealError('dealOnboarding: no common/uncommon species has moves');
  return loaner;
}

/** Rival candidates: common species with moves and `bst <= loaner.bst`, in `speciesOfRarity` order. */
export function rivalCandidates(loaner: Species, movesets: MovesetData): Species[] {
  return speciesOfRarity('common').filter((s) => s.bst <= loaner.bst && hasMoves(movesets)(s));
}

/** Rival try `k`: `candidates[floor(createRng(hashSeed(seed, 'rival', k))() × candidates.length)]`. */
export function rivalAt(seed: number, k: number, candidates: Species[]): Species | undefined {
  return candidates[Math.floor(createRng(hashSeed(seed, 'rival', k))() * candidates.length)];
}

const introMember = (species: Species, level: number): TeamMemberSpec => ({
  species,
  level,
  // IV 31, neutral nature, no talents — the same numbers `computeStats` gives for those inputs.
  stats: statsAtLevel(species.stats, level),
  badges: { stars: 1, talentIcons: [] },
});

/**
 * The two sides of the intro battle: the loaner (Red) at `economy.onboarding.loanerLevel` and the
 * rival (Blue) at `economy.onboarding.rivalLevel`, one fighter each, no talents.
 */
export function buildIntroTeams(
  loaner: Species,
  rival: Species,
  movesets: MovesetData,
  trainerName: string,
): { red: BattleTeam; blue: BattleTeam } {
  return {
    red: buildTeam({
      side: 'red',
      trainerName,
      members: [introMember(loaner, economy.onboarding.loanerLevel)],
      movesets,
    }),
    blue: buildTeam({
      side: 'blue',
      trainerName: INTRO_RIVAL_NAME,
      members: [introMember(rival, economy.onboarding.rivalLevel)],
      movesets,
    }),
  };
}

/**
 * Deals the onboarding cards for a save (flow first-visit step 1). Pure and deterministic per
 * `save.meta.seed`: the loaner from `pickLoaner`, then rivals k = 0, 1, … from `rivalAt` until
 * `findIntroSeed` finds a seed where the loaner wins (an `IntroSeedError` moves on to the next k).
 * Throws `OnboardingDealError` when nothing in `RIVAL_PICK_LIMIT` tries is winnable.
 */
export function dealOnboarding(
  save: Pick<Save, 'meta' | 'trainer'>,
  movesets: MovesetData,
): OnboardingDeal {
  const { seed } = save.meta;
  const loaner = pickLoaner(seed, movesets);
  const candidates = rivalCandidates(loaner, movesets);
  for (let k = 0; k < RIVAL_PICK_LIMIT; k++) {
    const rival = rivalAt(seed, k, candidates);
    if (!rival) break;
    const { red, blue } = buildIntroTeams(loaner, rival, movesets, save.trainer.name);
    try {
      const introSeed = findIntroSeed(red, blue);
      return { loanerSpeciesId: loaner.id, rivalSpeciesId: rival.id, introSeed, rivalPick: k };
    } catch (error) {
      if (error instanceof IntroSeedError) continue;
      throw error;
    }
  }
  throw new OnboardingDealError(
    `dealOnboarding: no winnable rival for ${loaner.name} in ${RIVAL_PICK_LIMIT} tries`,
  );
}
