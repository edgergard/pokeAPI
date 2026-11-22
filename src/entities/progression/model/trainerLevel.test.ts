import { describe, expect, it } from 'vitest';
import { economy } from '@/shared/config/economy';
import { makeSave } from './testSaves';
import {
  addTrainerXp,
  nextTrainerTalentPointLevel,
  nextUnlock,
  teamSlotUnlockLevel,
  teamSlots,
  trainerTimeline,
  unlocksAt,
  xpToNextTrainerLevel,
} from './trainerLevel';

describe('xpToNextTrainerLevel', () => {
  it('is linear: base + perLevel × (level − 1)', () => {
    expect(xpToNextTrainerLevel(1)).toBe(200);
    expect(xpToNextTrainerLevel(2)).toBe(300);
    expect(xpToNextTrainerLevel(10)).toBe(1100);
  });
});

describe('teamSlots', () => {
  it('grows 1 → 2 → 3 → 4 at Lv 1 / 3 / 5 / 10', () => {
    expect(teamSlots(1)).toBe(1);
    expect(teamSlots(2)).toBe(1);
    expect(teamSlots(3)).toBe(2);
    expect(teamSlots(4)).toBe(2);
    expect(teamSlots(5)).toBe(3);
    expect(teamSlots(9)).toBe(3);
    expect(teamSlots(10)).toBe(4);
    expect(teamSlots(economy.trainer.maxLevel)).toBe(4);
  });

  it('names the level a slot unlocks at', () => {
    expect([1, 2, 3, 4].map(teamSlotUnlockLevel)).toEqual([1, 3, 5, 10]);
    expect(teamSlotUnlockLevel(5)).toBeNull();
  });
});

describe('unlocksAt', () => {
  it('lists slots, systems, talents and the talent point', () => {
    expect(unlocksAt(2)).toEqual([
      { kind: 'dailyQuests' },
      { kind: 'trainerTalent', id: 'field-notes' },
      { kind: 'talentPoint', count: 1 },
    ]);
    expect(unlocksAt(3)).toEqual([
      { kind: 'teamSlot', slots: 2 },
      { kind: 'trainerTalent', id: 'dust-collector' },
      { kind: 'talentPoint', count: 1 },
    ]);
    expect(unlocksAt(8)).toEqual([{ kind: 'greatCapsules' }, { kind: 'talentPoint', count: 1 }]);
    expect(unlocksAt(10)).toEqual([
      { kind: 'teamSlot', slots: 4 },
      { kind: 'talentPoint', count: 1 },
    ]);
  });

  it('still gives the talent point on a level with nothing else', () => {
    expect(unlocksAt(7)).toEqual([{ kind: 'talentPoint', count: 1 }]);
  });

  it('gives no talent point at Lv 1', () => {
    expect(unlocksAt(1)).toEqual([{ kind: 'teamSlot', slots: 1 }]);
  });

  it('builds a timeline and finds the next system unlock', () => {
    const timeline = trainerTimeline();
    expect(timeline).toHaveLength(economy.trainer.maxLevel);
    expect(timeline[2]).toEqual({ level: 3, unlocks: unlocksAt(3) });
    expect(nextUnlock(1)).toEqual({ level: 2, unlocks: [{ kind: 'dailyQuests' }] });
    expect(nextUnlock(3)).toEqual({ level: 5, unlocks: [{ kind: 'teamSlot', slots: 3 }] });
    expect(nextUnlock(10)).toBeNull();
    expect(nextTrainerTalentPointLevel(1)).toBe(2);
    expect(nextTrainerTalentPointLevel(8)).toBe(9);
    expect(nextTrainerTalentPointLevel(economy.trainer.maxLevel)).toBeNull();
  });
});

describe('addTrainerXp', () => {
  it('adds XP towards the next level', () => {
    const save = makeSave();
    const result = addTrainerXp(save, 150);
    expect(result.save.trainer).toMatchObject({ level: 1, xp: 150, talentPoints: 0 });
    expect(result.levelsGained).toBe(0);
    expect(result.unlocks).toEqual([]);
    expect(save.trainer.xp).toBe(0);
  });

  it('levels up, grants a talent point and lists the unlocks', () => {
    const result = addTrainerXp(makeSave(), 210);
    expect(result.save.trainer).toMatchObject({ level: 2, xp: 10, talentPoints: 1 });
    expect(result.levelsGained).toBe(1);
    expect(result.talentPointsGained).toBe(1);
    expect(result.unlocks).toEqual(unlocksAt(2));
  });

  it('carries overflow across several levels', () => {
    // 200 + 300 + 400 = 900 → Lv 4, +50 left
    const result = addTrainerXp(makeSave(), 950);
    expect(result.save.trainer).toMatchObject({ level: 4, xp: 50, talentPoints: 3 });
    expect(result.levelsGained).toBe(3);
    expect(result.unlocks).toEqual([...unlocksAt(2), ...unlocksAt(3), ...unlocksAt(4)]);
  });

  it('stops at the max level with xp 0', () => {
    const result = addTrainerXp(makeSave(), 10_000_000);
    expect(result.save.trainer).toMatchObject({
      level: economy.trainer.maxLevel,
      xp: 0,
      talentPoints: economy.trainer.maxLevel - economy.trainer.talentPointsFromLevel + 1,
    });
    const again = addTrainerXp(result.save, 5000);
    expect(again.save).toBe(result.save);
    expect(again.levelsGained).toBe(0);
  });

  it('keeps the trainer talent points already owned', () => {
    const save = makeSave({ trainer: { level: 4, xp: 490, talentPoints: 2 } }); // Lv 4 → 5 needs 500
    const result = addTrainerXp(save, 10);
    expect(result.save.trainer).toMatchObject({ level: 5, xp: 0, talentPoints: 3 });
  });
});
