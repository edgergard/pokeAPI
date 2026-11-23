import type { Save } from '@/entities/save';
import { economy } from '@/shared/config/economy';

type LadderProgress = Pick<Save, 'ladder'>;

/** How a stage looks on the ladder for this save. */
export type StageStatus = 'cleared' | 'current' | 'locked';

/**
 * `cleared`: stage ≤ `ladder.cleared` (replay for XP); `current`: the next stage to clear;
 * `locked`: further up. After the last stage every stage is `cleared` (no `current`).
 */
export function stageStatus(save: LadderProgress, stage: number): StageStatus {
  const { cleared } = save.ladder;
  if (stage <= cleared) return 'cleared';
  return stage === cleared + 1 && stage <= economy.battle.ladderStages ? 'current' : 'locked';
}

/** Whether the stage can be fought now: 1..`ladderStages` and at most `ladder.cleared + 1`. */
export function isStageUnlocked(save: LadderProgress, stage: number): boolean {
  return (
    Number.isInteger(stage) &&
    stage >= 1 &&
    stage <= economy.battle.ladderStages &&
    stage <= save.ladder.cleared + 1
  );
}

/** The stage to fight next: `ladder.cleared + 1`, capped at the last stage. */
export function nextStageToFight(save: LadderProgress): number {
  return Math.max(1, Math.min(save.ladder.cleared + 1, economy.battle.ladderStages));
}

/** Every stage cleared ("Ladder complete"). */
export function isLadderComplete(save: LadderProgress): boolean {
  return save.ladder.cleared >= economy.battle.ladderStages;
}
