import { describe, expect, it } from 'vitest';
import { nextUnlock, teamSlotUnlockLevel, teamSlots } from '@/entities/progression';
import { economy } from '@/shared/config/economy';
import { collectionOf, homeSave, ownedMon } from '../testing';
import {
  MAX_TEAM_SLOTS,
  firstClearText,
  ladderComplete,
  nextStage,
  nextUnlockText,
  teamStrip,
} from './hub';
import { claimAnnouncement } from './quests';

describe('nextStage', () => {
  it('is one past the highest cleared stage, capped at the last stage', () => {
    expect(nextStage({ ladder: { cleared: 0, replayWins: 0 } })).toBe(1);
    expect(nextStage({ ladder: { cleared: 6, replayWins: 0 } })).toBe(7);
    const last = economy.battle.ladderStages;
    expect(nextStage({ ladder: { cleared: last, replayWins: 0 } })).toBe(last);
    expect(ladderComplete({ ladder: { cleared: last, replayWins: 0 } })).toBe(true);
    expect(ladderComplete({ ladder: { cleared: last - 1, replayWins: 0 } })).toBe(false);
  });
});

describe('firstClearText', () => {
  it('is built from economy.battle.firstClear', () => {
    const { capsules, dust } = economy.battle.firstClear;
    expect(firstClearText()).toBe(`+${capsules.basic} Basic capsule · +${dust} dust`);
  });
});

describe('nextUnlockText', () => {
  it('names the next system unlock with its level from nextUnlock', () => {
    for (const level of [1, 2, 3, 4, 8]) {
      const next = nextUnlock(level);
      expect(nextUnlockText(level)).toMatch(new RegExp(`^Next: Lv ${next?.level} · `));
    }
    const slotLevel = economy.trainer.teamSlots.find((e) => e.slots === 3)?.level ?? 0;
    expect(nextUnlockText(slotLevel - 1)).toBe(`Next: Lv ${slotLevel} · team slot 3`);
    expect(nextUnlockText(economy.trainer.unlocks.dailyQuests - 1)).toBe(
      `Next: Lv ${economy.trainer.unlocks.dailyQuests} · daily quests`,
    );
  });

  it('is null when nothing is left to unlock', () => {
    expect(nextUnlockText(economy.trainer.maxLevel)).toBeNull();
  });
});

describe('teamStrip', () => {
  it('shows members, open empty slots and locked slots with their unlock level', () => {
    const level = economy.trainer.teamSlots.find((e) => e.slots === 2)?.level ?? 1;
    const save = homeSave({
      trainer: { level },
      team: [25],
      collection: collectionOf(ownedMon(25), ownedMon(1)),
    });
    const strip = teamStrip(save);
    expect(strip).toHaveLength(MAX_TEAM_SLOTS);
    expect(strip[0]).toMatchObject({ kind: 'member', slot: 1 });
    expect(teamSlots(level)).toBe(2);
    expect(strip[1]).toEqual({ kind: 'empty', slot: 2 });
    expect(strip[2]).toEqual({ kind: 'locked', slot: 3, unlockLevel: teamSlotUnlockLevel(3) });
    expect(strip[3]).toEqual({ kind: 'locked', slot: 4, unlockLevel: teamSlotUnlockLevel(4) });
  });

  it('skips team ids that are not in the collection', () => {
    const save = homeSave({ team: [999], collection: {} });
    expect(teamStrip(save)[0]).toEqual({ kind: 'empty', slot: 1 });
  });
});

describe('claimAnnouncement', () => {
  it('lists the reward and the trainer XP, plus the new level on a level-up', () => {
    const base = {
      ok: true as const,
      reward: { capsules: { basic: 0, great: 0 }, dust: 30 },
      trainerXp: 80,
      unlocks: [],
      talentPointsGained: 0,
    };
    expect(claimAnnouncement({ ...base, save: homeSave(), levelsGained: 0 })).toBe(
      '+30 dust · +80 Trainer XP',
    );
    expect(
      claimAnnouncement({
        ...base,
        reward: { capsules: { basic: 1, great: 0 }, dust: 0 },
        save: homeSave({ trainer: { level: 3 } }),
        levelsGained: 1,
      }),
    ).toBe('+1 Basic capsule · +80 Trainer XP · Trainer Lv 3');
  });
});
