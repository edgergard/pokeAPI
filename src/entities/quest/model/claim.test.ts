import { describe, expect, it } from 'vitest';
import { unlocksAt } from '@/entities/progression';
import { createNewSave, type Quest, type Save } from '@/entities/save';
import { economy } from '@/shared/config/economy';
import { claimQuest } from './claim';

const DAY = '2026-11-22';

function withQuests(active: Quest[], trainer: Partial<Save['trainer']> = {}): Save {
  const save = createNewSave({ seed: 1, now: 0, name: 'Ash' });
  return {
    ...save,
    trainer: { ...save.trainer, level: 2, ...trainer },
    quests: { active, lastIssuedDay: DAY },
  };
}

const quest = (id: string, progress: number, target: number, claimed = false): Quest => ({
  id,
  progress,
  target,
  day: DAY,
  claimed,
});

describe('claimQuest', () => {
  it('grants the pool reward and trainer XP, and marks the quest claimed', () => {
    const save = withQuests([quest('win-battles', 3, 3), quest('open-capsules', 0, 2)]);
    const result = claimQuest(save, 'win-battles', DAY);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.reward).toEqual({ capsules: { basic: 1, great: 0 }, dust: 0 });
    expect(result.trainerXp).toBe(economy.quests.trainerXp);
    expect(result.levelsGained).toBe(0);
    expect(result.save.capsules.basic).toBe(1);
    expect(result.save.trainer.xp).toBe(economy.quests.trainerXp);
    expect(result.save.quests.active.map((q) => q.claimed)).toEqual([true, false]);
    expect(save.quests.active[0]?.claimed).toBe(false);
  });

  it('rejects a double claim', () => {
    const save = withQuests([quest('win-battles', 3, 3)]);
    const first = claimQuest(save, 'win-battles', DAY);
    if (!first.ok) throw new Error('first claim failed');
    expect(claimQuest(first.save, 'win-battles', DAY)).toEqual({
      ok: false,
      reason: 'alreadyClaimed',
    });
  });

  it('rejects unfinished and unknown quests', () => {
    const save = withQuests([quest('open-capsules', 1, 2)]);
    expect(claimQuest(save, 'open-capsules', DAY)).toEqual({ ok: false, reason: 'notFinished' });
    expect(claimQuest(save, 'open-capsules', '2026-11-21')).toEqual({
      ok: false,
      reason: 'notFound',
    });
    expect(claimQuest(save, 'nope', DAY)).toEqual({ ok: false, reason: 'notFound' });
  });

  it('applies the trainer dust bonus to dust rewards', () => {
    const save = withQuests([quest('open-capsules', 2, 2)], {
      level: 3,
      talents: ['dust-collector'],
    });
    const result = claimQuest(save, 'open-capsules', DAY);
    if (!result.ok) throw new Error('claim failed');
    expect(result.reward.dust).toBe(33); // 30 + 10%
    expect(result.save.dust).toBe(33);
  });

  it('reports trainer level-ups and their unlocks', () => {
    // Lv 2 → 3 needs 300; 250 + 80 = 330
    const save = withQuests([quest('level-up', 2, 2)], { level: 2, xp: 250, talentPoints: 1 });
    const result = claimQuest(save, 'level-up', DAY);
    if (!result.ok) throw new Error('claim failed');
    expect(result.levelsGained).toBe(1);
    expect(result.unlocks).toEqual(unlocksAt(3));
    expect(result.talentPointsGained).toBe(1);
    expect(result.save.trainer).toMatchObject({ level: 3, xp: 30, talentPoints: 2 });
  });
});
