import type { OnboardingStep, OwnedPokemon, Save } from '@/entities/save';
import type { OnboardingDeal } from './dealOnboarding';

/**
 * The onboarding step Home shows. Same as `save.onboarding.step`, except:
 * - `fought` with no basic capsule left and a non-empty collection: the capsule was opened elsewhere
 *   (e.g. on the battle result) before the step moved on → `capsule`;
 * - `capsule` with an empty collection: nothing to add yet → `fought` (open the capsule first).
 */
export function homeStep(
  save: Pick<Save, 'onboarding' | 'capsules' | 'collection'>,
): OnboardingStep {
  const { step, loanerSpeciesId, rivalSpeciesId } = save.onboarding;
  // A deal without both cards can't be fought: deal again.
  if (step === 'dealt' && (loanerSpeciesId === null || rivalSpeciesId === null)) return 'hero';
  const owned = Object.keys(save.collection).length > 0;
  if (step === 'fought' && save.capsules.basic === 0 && owned) return 'capsule';
  if (step === 'capsule' && !owned) return 'fought';
  return step;
}

/** The first Pokémon the player got: the collection entry with the lowest `obtainedAt` (then id). */
export function firstOwned(save: Pick<Save, 'collection'>): OwnedPokemon | null {
  let first: OwnedPokemon | null = null;
  for (const owned of Object.values(save.collection)) {
    if (
      !first ||
      owned.obtainedAt < first.obtainedAt ||
      (owned.obtainedAt === first.obtainedAt && owned.speciesId < first.speciesId)
    ) {
      first = owned;
    }
  }
  return first;
}

/** hero → dealt with the dealt species. No-op (same object) unless Home shows the hero step. */
export function commitDeal(
  save: Save,
  deal: Pick<OnboardingDeal, 'loanerSpeciesId' | 'rivalSpeciesId'>,
): Save {
  if (homeStep(save) !== 'hero') return save;
  return {
    ...save,
    onboarding: {
      step: 'dealt',
      loanerSpeciesId: deal.loanerSpeciesId,
      rivalSpeciesId: deal.rivalSpeciesId,
    },
  };
}

/** fought → capsule, right after the first capsule was opened (a reload must not re-roll). */
export function markCapsuleOpened(save: Save): Save {
  if (save.onboarding.step !== 'fought') return save;
  return { ...save, onboarding: { ...save.onboarding, step: 'capsule' } };
}

/**
 * "Add to team": the first own Pokémon replaces the loaner and onboarding ends. No-op (same object)
 * when onboarding is already done or the species isn't owned.
 */
export function addFirstToTeam(save: Save, speciesId: number): Save {
  if (save.onboarding.step === 'done') return save;
  if (!save.collection[String(speciesId)]) return save;
  return { ...save, team: [speciesId], onboarding: { ...save.onboarding, step: 'done' } };
}

/**
 * A v1 player arriving on the hub for the first time: the save came from the v1 roster migration and
 * nothing has happened in v2 yet (no capsule opened, no stage cleared).
 */
export function isFreshV1Import(
  save: Pick<Save, 'meta' | 'onboarding' | 'capsulesOpened' | 'ladder'>,
): boolean {
  return (
    save.meta.migratedFromV1 &&
    save.onboarding.step === 'done' &&
    save.capsulesOpened === 0 &&
    save.ladder.cleared === 0
  );
}
