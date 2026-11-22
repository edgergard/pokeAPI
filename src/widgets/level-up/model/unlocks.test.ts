import { describe, expect, it } from 'vitest';
import { addTrainerXp, unlocksAt, xpToNextTrainerLevel } from '@/entities/progression';
import { makeSave } from '@/entities/ladder/testing/testSave';
import { economy } from '@/shared/config/economy';
import { primaryAction, unlockLines } from './unlocks';

const slotLevel = (slots: number) =>
  economy.trainer.teamSlots.find((e) => e.slots === slots)?.level ?? 0;

describe('level-up unlocks', () => {
  it('lists a level’s unlocks from unlocksAt', () => {
    expect(unlockLines(unlocksAt(slotLevel(2)))).toContain('Team slot 2');
    expect(unlockLines(unlocksAt(economy.trainer.unlocks.dailyQuests))).toContain('Daily quests');
    expect(unlockLines(unlocksAt(economy.trainer.unlocks.greatCapsules))).toContain(
      'Great capsules',
    );
    expect(unlockLines([{ kind: 'talentPoint', count: 1 }])).toEqual(['1 talent point']);
  });

  it('merges several levels: talent points summed and listed last', () => {
    expect(
      unlockLines([
        { kind: 'dailyQuests' },
        { kind: 'talentPoint', count: 1 },
        { kind: 'teamSlot', slots: 2 },
        { kind: 'talentPoint', count: 1 },
      ]),
    ).toEqual(['Daily quests', 'Team slot 2', '2 talent points']);
    expect(unlockLines([])).toEqual([]);
  });

  it('picks the contextual primary: slot, then quests, then talent', () => {
    expect(primaryAction([{ kind: 'dailyQuests' }, { kind: 'teamSlot', slots: 2 }])).toEqual({
      kind: 'fillSlot',
      slot: 2,
      label: 'Fill slot 2',
    });
    expect(primaryAction([{ kind: 'dailyQuests' }, { kind: 'talentPoint', count: 1 }])).toEqual({
      kind: 'link',
      href: '/',
      label: 'See quests',
    });
    expect(primaryAction([{ kind: 'talentPoint', count: 1 }])).toEqual({
      kind: 'link',
      href: '/trainer/',
      label: 'Learn talent',
    });
    expect(primaryAction([])).toMatchObject({ label: 'Learn talent' });
  });

  it('matches what a real level-up from addTrainerXp unlocks', () => {
    const save = makeSave({ trainer: { level: slotLevel(2) - 1, xp: 0 } });
    const result = addTrainerXp(save, xpToNextTrainerLevel(slotLevel(2) - 1));
    expect(primaryAction(result.unlocks)).toMatchObject({ kind: 'fillSlot', slot: 2 });
  });
});
