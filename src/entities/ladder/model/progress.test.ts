import { describe, expect, it } from 'vitest';
import { economy } from '@/shared/config/economy';
import { isLadderComplete, isStageUnlocked, nextStageToFight, stageStatus } from './progress';

const STAGES = economy.battle.ladderStages;
const at = (cleared: number) => ({ ladder: { cleared, replayWins: 0 } });

describe('ladder progress', () => {
  it('marks cleared, current and locked stages from ladder.cleared', () => {
    expect(stageStatus(at(0), 1)).toBe('current');
    expect(stageStatus(at(0), 2)).toBe('locked');
    expect(stageStatus(at(6), 6)).toBe('cleared');
    expect(stageStatus(at(6), 7)).toBe('current');
    expect(stageStatus(at(6), 8)).toBe('locked');
  });

  it('has no current stage once the ladder is complete', () => {
    for (let s = 1; s <= STAGES; s++) expect(stageStatus(at(STAGES), s)).toBe('cleared');
    expect(isLadderComplete(at(STAGES))).toBe(true);
    expect(isLadderComplete(at(STAGES - 1))).toBe(false);
  });

  it('points at the next stage to fight, capped at the last stage', () => {
    expect(nextStageToFight(at(0))).toBe(1);
    expect(nextStageToFight(at(6))).toBe(7);
    expect(nextStageToFight(at(STAGES))).toBe(STAGES);
  });

  it('unlocks stages 1..cleared + 1 within the ladder', () => {
    expect(isStageUnlocked(at(0), 1)).toBe(true);
    expect(isStageUnlocked(at(0), 2)).toBe(false);
    expect(isStageUnlocked(at(6), 3)).toBe(true);
    expect(isStageUnlocked(at(6), 7)).toBe(true);
    expect(isStageUnlocked(at(6), 8)).toBe(false);
    expect(isStageUnlocked(at(STAGES), STAGES + 1)).toBe(false);
    expect(isStageUnlocked(at(3), 0)).toBe(false);
    expect(isStageUnlocked(at(3), 1.5)).toBe(false);
  });
});
