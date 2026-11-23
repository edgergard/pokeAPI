import { describe, expect, it } from 'vitest';
import { createNewSave, type Quest, type Save } from '@/entities/save';
import { questEventReducer } from './reducer';

const DAY = '2026-11-22';

function withQuests(active: Quest[]): Save {
  const save = createNewSave({ seed: 1, now: 0, name: 'Ash' });
  return { ...save, quests: { active, lastIssuedDay: DAY } };
}

const quest = (id: string, target: number, extra: Partial<Quest> = {}): Quest => ({
  id,
  progress: 0,
  target,
  day: DAY,
  claimed: false,
  ...extra,
});

describe('questEventReducer', () => {
  it('advances matching quests by 1', () => {
    const save = withQuests([quest('win-battles', 3), quest('open-capsules', 2)]);
    const next = questEventReducer(save, { kind: 'battleWon', stage: 2 });
    expect(next.quests.active.map((q) => q.progress)).toEqual([1, 0]);
    expect(save.quests.active[0]?.progress).toBe(0);
  });

  it('advances damage quests by the amount, clamped at the target', () => {
    let save = withQuests([quest('deal-damage', 500)]);
    save = questEventReducer(save, { kind: 'damageDealt', amount: 320 });
    expect(save.quests.active[0]?.progress).toBe(320);
    save = questEventReducer(save, { kind: 'damageDealt', amount: 320 });
    expect(save.quests.active[0]?.progress).toBe(500);
  });

  it('advances every live matching quest, including stocked days', () => {
    const save = withQuests([
      quest('level-up', 2, { day: '2026-11-21' }),
      quest('level-up', 2, { day: DAY }),
    ]);
    const next = questEventReducer(save, { kind: 'pokemonLeveled', speciesId: 25, level: 4 });
    expect(next.quests.active.map((q) => q.progress)).toEqual([1, 1]);
  });

  it('returns the same save when nothing matches or everything is done', () => {
    const save = withQuests([
      quest('win-battles', 3, { progress: 3 }),
      quest('open-capsules', 2, { progress: 2, claimed: true }),
      quest('clear-stage', 1, { progress: 1 }),
    ]);
    expect(questEventReducer(save, { kind: 'battleWon', stage: 1 })).toBe(save);
    expect(
      questEventReducer(save, {
        kind: 'capsuleOpened',
        tier: 'basic',
        rarity: 'common',
        speciesId: 1,
        duplicate: false,
      }),
    ).toBe(save);
    expect(questEventReducer(save, { kind: 'stageCleared', stage: 2 })).toBe(save);
    expect(questEventReducer(save, { kind: 'trainerLeveled', level: 3 })).toBe(save);
    expect(
      questEventReducer(withQuests([quest('deal-damage', 500)]), {
        kind: 'damageDealt',
        amount: 0,
      }).quests.active[0]?.progress,
    ).toBe(0);
  });
});
