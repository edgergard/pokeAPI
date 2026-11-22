import { isStageUnlocked } from '@/entities/ladder';
import type { OnboardingStep, Save } from '@/entities/save';
import { economy } from '@/shared/config/economy';

/** What `/battle/?stage=…` shows for this save, or where it sends the player instead. */
export type BattleRoute =
  { kind: 'stage'; stage: number } | { kind: 'intro' } | { kind: 'redirect'; to: string };

/** Onboarding steps during which `?stage=intro` is the battle (fight, result, capsule). */
const INTRO_STEPS: ReadonlySet<OnboardingStep> = new Set(['dealt', 'fought', 'capsule']);

/** `?stage=N` as a stage number: digits only, 1..`economy.battle.ladderStages`; null otherwise. */
export function parseStage(raw: string | null): number | null {
  if (raw === null || !/^\d{1,3}$/.test(raw)) return null;
  const stage = Number(raw);
  return stage >= 1 && stage <= economy.battle.ladderStages ? stage : null;
}

/**
 * Validates the deep link against the save:
 * - `intro`: only while onboarding is at `dealt` (with the dealt loaner and rival), `fought` or
 *   `capsule`; otherwise Home.
 * - before onboarding is done every other link goes Home;
 * - no `?stage` → the ladder; a malformed one → `/ladder/?invalid=1`; a stage past
 *   `ladder.cleared + 1` → `/ladder/?locked=N` (the ladder says "Stage locked").
 */
export function resolveBattleRoute(
  save: Pick<Save, 'onboarding' | 'ladder'>,
  raw: string | null,
): BattleRoute {
  const { step, loanerSpeciesId, rivalSpeciesId } = save.onboarding;
  if (raw === 'intro') {
    if (!INTRO_STEPS.has(step)) return { kind: 'redirect', to: '/' };
    if (step === 'dealt' && (loanerSpeciesId === null || rivalSpeciesId === null)) {
      return { kind: 'redirect', to: '/' };
    }
    return { kind: 'intro' };
  }
  if (step !== 'done') return { kind: 'redirect', to: '/' };
  if (raw === null || raw === '') return { kind: 'redirect', to: '/ladder/' };
  const stage = parseStage(raw);
  if (stage === null) return { kind: 'redirect', to: '/ladder/?invalid=1' };
  if (!isStageUnlocked(save, stage)) return { kind: 'redirect', to: `/ladder/?locked=${stage}` };
  return { kind: 'stage', stage };
}

/** Link to a stage's battle preview (trailing slash: the exported `battle/index.html`). */
export const stageHref = (stage: number) => `/battle/?stage=${stage}`;
