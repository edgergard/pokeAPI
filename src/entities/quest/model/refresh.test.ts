import { describe, expect, it } from 'vitest';
import { createNewSave, type Save } from '@/entities/save';
import { economy } from '@/shared/config/economy';
import { pickDailyQuests, refreshQuests } from './refresh';

// Local-time constructor (November 2026) so the tests pass in any time zone. refreshHour = 6.
const nov = (d: number, h = 12, min = 0) => new Date(2026, 10, d, h, min).getTime();

function questSave(level: number = economy.trainer.unlocks.dailyQuests, seed = 7): Save {
  const save = createNewSave({ seed, now: nov(1, 0), name: 'Ash' });
  return { ...save, trainer: { ...save.trainer, level } };
}

const days = (save: Save) => save.quests.active.map((q) => q.day);

describe('pickDailyQuests', () => {
  it('picks dailyCount distinct pool quests, fresh and unclaimed', () => {
    const quests = pickDailyQuests(7, '2026-11-22');
    expect(quests).toHaveLength(economy.quests.dailyCount);
    expect(new Set(quests.map((q) => q.id)).size).toBe(economy.quests.dailyCount);
    for (const quest of quests) {
      const entry = economy.quests.pool.find((p) => p.id === quest.id);
      expect(entry).toBeDefined();
      expect(quest).toEqual({
        id: quest.id,
        progress: 0,
        target: entry?.target,
        day: '2026-11-22',
        claimed: false,
      });
    }
  });

  it('is deterministic per seed and day', () => {
    expect(pickDailyQuests(7, '2026-11-22')).toEqual(pickDailyQuests(7, '2026-11-22'));
    const picks = new Set(
      Array.from({ length: 20 }, (_, i) =>
        pickDailyQuests(7, `2026-12-${String(i + 1).padStart(2, '0')}`)
          .map((q) => q.id)
          .join(','),
      ),
    );
    expect(picks.size).toBeGreaterThan(1);
  });
});

describe('refreshQuests', () => {
  it('issues nothing while quests are locked, but records the seen time', () => {
    const save = questSave(1);
    const next = refreshQuests(save, nov(22));
    expect(next.quests).toEqual({ active: [], lastIssuedDay: null });
    expect(next.meta.maxSeenTime).toBe(nov(22));
  });

  it('issues today’s quests once unlocked', () => {
    const next = refreshQuests(questSave(), nov(22));
    expect(next.quests.active).toEqual(pickDailyQuests(7, '2026-11-22'));
    expect(next.quests.lastIssuedDay).toBe('2026-11-22');
    expect(next.meta.maxSeenTime).toBe(nov(22));
  });

  it('is idempotent for the same now', () => {
    const save = questSave();
    const once = refreshQuests(save, nov(22));
    expect(refreshQuests(once, nov(22))).toBe(once);
    expect(refreshQuests(save, nov(22))).toEqual(once);
  });

  it('stocks up to maxStockDays days of quests', () => {
    let save = refreshQuests(questSave(), nov(22));
    save = refreshQuests(save, nov(23));
    expect(save.quests.active).toHaveLength(6);
    save = refreshQuests(save, nov(24));
    expect(save.quests.active).toHaveLength(
      economy.quests.dailyCount * economy.quests.maxStockDays,
    );
    save = refreshQuests(save, nov(25));
    expect(save.quests.active).toHaveLength(9);
    expect(new Set(days(save))).toEqual(new Set(['2026-11-23', '2026-11-24', '2026-11-25']));
  });

  it('issues only the last maxStockDays days after a long break', () => {
    let save = refreshQuests(questSave(), nov(22));
    save = refreshQuests(save, new Date(2026, 11, 2, 9).getTime());
    expect(save.quests.active).toHaveLength(9);
    expect(new Set(days(save))).toEqual(new Set(['2026-11-30', '2026-12-01', '2026-12-02']));
    expect(save.quests.lastIssuedDay).toBe('2026-12-02');
  });

  it('drops claimed quests of earlier days but keeps today’s', () => {
    let save = refreshQuests(questSave(), nov(22));
    const [first, ...rest] = save.quests.active;
    if (!first) throw new Error('no quests');
    save = { ...save, quests: { ...save.quests, active: [{ ...first, claimed: true }, ...rest] } };
    const later = refreshQuests(save, nov(22, 20));
    expect(later.quests.active).toHaveLength(3);
    const tomorrow = refreshQuests(later, nov(23));
    expect(tomorrow.quests.active).toHaveLength(5);
    expect(tomorrow.quests.active.some((q) => q.id === first.id && q.day === first.day)).toBe(
      false,
    );
  });

  it('switches the day at the refresh hour, not at midnight', () => {
    const issued = refreshQuests(questSave(), nov(22));
    const beforeRefresh = refreshQuests(issued, nov(23, 5, 59));
    expect(beforeRefresh.quests).toBe(issued.quests);
    const afterRefresh = refreshQuests(beforeRefresh, nov(23, 6));
    expect(afterRefresh.quests.active).toHaveLength(6);
    expect(afterRefresh.quests.lastIssuedDay).toBe('2026-11-23');
  });

  it('changes nothing when the clock moves back', () => {
    const issued = refreshQuests(questSave(), nov(24));
    const progressed: Save = {
      ...issued,
      quests: {
        ...issued.quests,
        active: issued.quests.active.map((q) => ({ ...q, progress: 1 })),
      },
    };
    expect(refreshQuests(progressed, nov(23))).toBe(progressed);
    expect(refreshQuests(progressed, nov(24, 5))).toBe(progressed);
    // once the clock catches up again, normal refreshes resume
    const resumed = refreshQuests(progressed, nov(25));
    expect(resumed.quests.active).toHaveLength(6);
  });
});
