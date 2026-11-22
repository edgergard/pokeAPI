import type { Save } from '@/entities/save';
import { economy } from '@/shared/config/economy';
import { TRAINER_TALENTS } from './talents';

/** XP the trainer needs to go from `level` to `level + 1` (linear). */
export function xpToNextTrainerLevel(level: number): number {
  const { base, perLevel } = economy.trainer.xpToNext;
  return base + perLevel * (level - 1);
}

/** What reaching a trainer level gives (level-up dialog, trainer timeline). */
export type TrainerUnlock =
  | { kind: 'teamSlot'; slots: number }
  | { kind: 'dailyQuests' }
  | { kind: 'greatCapsules' }
  | { kind: 'trainerTalent'; id: string }
  | { kind: 'talentPoint'; count: number };

const slotsByLevelDesc = [...economy.trainer.teamSlots].sort((a, b) => b.level - a.level);

/** Team size at a trainer level. */
export function teamSlots(level: number): number {
  const entry =
    slotsByLevelDesc.find((e) => e.level <= level) ?? slotsByLevelDesc[slotsByLevelDesc.length - 1];
  return entry?.slots ?? 0;
}

/** Trainer level that unlocks team slot number `slot` (1-based), or null if it never unlocks. */
export function teamSlotUnlockLevel(slot: number): number | null {
  const entry = [...slotsByLevelDesc].reverse().find((e) => e.slots >= slot);
  return entry?.level ?? null;
}

/** Trainer talent points granted on reaching `level`. */
export function trainerTalentPointsAt(level: number): number {
  return level >= economy.trainer.talentPointsFromLevel && level <= economy.trainer.maxLevel
    ? 1
    : 0;
}

/**
 * Everything reaching `level` unlocks, derived from `economy.trainer` and `TRAINER_TALENTS`. Order:
 * team slot, daily quests, Great capsules, newly learnable trainer talents, talent point.
 */
export function unlocksAt(level: number): TrainerUnlock[] {
  const out: TrainerUnlock[] = [];
  const slot = economy.trainer.teamSlots.find((e) => e.level === level);
  if (slot) out.push({ kind: 'teamSlot', slots: slot.slots });
  if (level === economy.trainer.unlocks.dailyQuests) out.push({ kind: 'dailyQuests' });
  if (level === economy.trainer.unlocks.greatCapsules) out.push({ kind: 'greatCapsules' });
  for (const talent of TRAINER_TALENTS) {
    if (talent.requiresLevel === level) out.push({ kind: 'trainerTalent', id: talent.id });
  }
  const points = trainerTalentPointsAt(level);
  if (points > 0) out.push({ kind: 'talentPoint', count: points });
  return out;
}

/** Levels 1 → max with their unlocks (trainer screen timeline). */
export function trainerTimeline(): { level: number; unlocks: TrainerUnlock[] }[] {
  return Array.from({ length: economy.trainer.maxLevel }, (_, i) => ({
    level: i + 1,
    unlocks: unlocksAt(i + 1),
  }));
}

/**
 * The next level above `level` that unlocks a system (team slot, quests, capsule tier) — the hub's
 * "Next: Lv 5 · team slot 3". Talent points and talents are skipped. Null when nothing is left.
 */
export function nextUnlock(level: number): { level: number; unlocks: TrainerUnlock[] } | null {
  for (let l = level + 1; l <= economy.trainer.maxLevel; l++) {
    const unlocks = unlocksAt(l).filter(
      (u) => u.kind === 'teamSlot' || u.kind === 'dailyQuests' || u.kind === 'greatCapsules',
    );
    if (unlocks.length > 0) return { level: l, unlocks };
  }
  return null;
}

/** The next level above `level` that grants a trainer talent point ("Next point at Lv 9"), or null. */
export function nextTrainerTalentPointLevel(level: number): number | null {
  for (let l = level + 1; l <= economy.trainer.maxLevel; l++) {
    if (trainerTalentPointsAt(l) > 0) return l;
  }
  return null;
}

export type TrainerXpResult = {
  save: Save;
  levelsGained: number;
  /** Concatenated `unlocksAt(level)` of every level gained, in order. */
  unlocks: TrainerUnlock[];
  talentPointsGained: number;
};

/**
 * Adds trainer XP: carries overflow across levels, stops at `economy.trainer.maxLevel` (xp 0 there) and
 * grants trainer talent points for every level reached from `economy.trainer.talentPointsFromLevel` on.
 * Doesn't emit `trainerLeveled` events — callers do (see `applyBattleResult`, `claimQuest`).
 */
export function addTrainerXp(save: Save, amount: number): TrainerXpResult {
  const max = economy.trainer.maxLevel;
  let { level, xp } = save.trainer;
  xp += Math.max(0, Math.floor(amount));
  const unlocks: TrainerUnlock[] = [];
  let talentPointsGained = 0;
  while (level < max) {
    const need = xpToNextTrainerLevel(level);
    if (xp < need) break;
    xp -= need;
    level += 1;
    unlocks.push(...unlocksAt(level));
    talentPointsGained += trainerTalentPointsAt(level);
  }
  if (level >= max) xp = 0;
  if (level === save.trainer.level && xp === save.trainer.xp) {
    return { save, levelsGained: 0, unlocks, talentPointsGained };
  }
  return {
    save: {
      ...save,
      trainer: {
        ...save.trainer,
        level,
        xp,
        talentPoints: save.trainer.talentPoints + talentPointsGained,
      },
    },
    levelsGained: level - save.trainer.level,
    unlocks,
    talentPointsGained,
  };
}
