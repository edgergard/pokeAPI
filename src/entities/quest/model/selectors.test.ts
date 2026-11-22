import { describe, expect, it } from 'vitest';
import { createNewSave, type Quest, type Save } from '@/entities/save';
import { economy } from '@/shared/config/economy';
import { claimableQuestCount, questBoard, questRows } from './selectors';

const now = new Date(2026, 10, 22, 12).getTime();

function withQuests(active: Quest[], level = 2): Save {
  const save = createNewSave({ seed: 1, now, name: 'Ash' });
  return {
    ...save,
    trainer: { ...save.trainer, level },
    quests: { active, lastIssuedDay: '2026-11-22' },
  };
}

const quest = (id: string, day: string, progress: number, claimed = false): Quest => {
  const target = economy.quests.pool.find((q) => q.id === id)?.target ?? 1;
  return { id, progress, target, day, claimed };
};

describe('questRows', () => {
  it('joins pool data and sorts by day, then pool order', () => {
    const rows = questRows(
      withQuests([
        quest('level-up', '2026-11-22', 0),
        quest('win-battles', '2026-11-22', 3),
        quest('deal-damage', '2026-11-21', 10),
        quest('retired-quest', '2026-11-22', 0),
      ]),
    );
    expect(rows.map((r) => `${r.day}:${r.id}`)).toEqual([
      '2026-11-21:deal-damage',
      '2026-11-22:win-battles',
      '2026-11-22:level-up',
    ]);
    expect(rows[1]).toMatchObject({
      kind: 'battleWon',
      finished: true,
      claimable: true,
      reward: { capsules: { basic: 1 } },
    });
  });
});

describe('questBoard', () => {
  it('is locked below the unlock level', () => {
    expect(questBoard(withQuests([], 1), now)).toEqual({
      state: 'locked',
      unlockLevel: economy.trainer.unlocks.dailyQuests,
    });
  });

  it('is open while a quest is unclaimed', () => {
    const save = withQuests([
      quest('win-battles', '2026-11-22', 3),
      quest('open-capsules', '2026-11-22', 0),
    ]);
    const board = questBoard(save, now);
    expect(board).toMatchObject({
      state: 'open',
      claimable: 1,
      today: '2026-11-22',
      nextRefreshAt: new Date(2026, 10, 23, 6).getTime(),
      clockBehind: false,
      refreshHour: economy.quests.refreshHour,
    });
    expect(claimableQuestCount(save)).toBe(1);
  });

  it('is allClaimed when nothing is left (or nothing was issued)', () => {
    const done = withQuests([quest('win-battles', '2026-11-22', 3, true)]);
    expect(questBoard(done, now).state).toBe('allClaimed');
    expect(questBoard(withQuests([]), now).state).toBe('allClaimed');
  });

  it('flags a clock that moved back', () => {
    const save = withQuests([quest('win-battles', '2026-11-22', 0)]);
    const board = questBoard(save, now - 3_600_000);
    expect(board).toMatchObject({ clockBehind: true });
  });
});
