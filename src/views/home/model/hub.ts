import {
  nextUnlock,
  teamSlotUnlockLevel,
  teamSlots,
  type TrainerUnlock,
} from '@/entities/progression';
import type { OwnedPokemon, Save } from '@/entities/save';
import { economy } from '@/shared/config/economy';
import { rewardParts } from '@/widgets/quest-list';

/** Team slots the game ever opens (the largest entry of `economy.trainer.teamSlots`). */
export const MAX_TEAM_SLOTS = Math.max(...economy.trainer.teamSlots.map((e) => e.slots));

/**
 * The ladder stage to fight next: one past the highest cleared, capped at the last stage.
 * TODO(2-play): use the "next stage to fight" helper from entities/ladder once it is merged.
 */
export function nextStage(save: Pick<Save, 'ladder'>): number {
  return Math.min(save.ladder.cleared + 1, economy.battle.ladderStages);
}

/** Every stage is cleared: the next-stage card offers a replay. */
export function ladderComplete(save: Pick<Save, 'ladder'>): boolean {
  return save.ladder.cleared >= economy.battle.ladderStages;
}

/** "+1 Basic capsule · +20 dust" from `economy.battle.firstClear`. */
export function firstClearText(): string {
  return rewardParts(economy.battle.firstClear).join(' · ');
}

function unlockText(unlock: TrainerUnlock): string {
  switch (unlock.kind) {
    case 'teamSlot':
      return `team slot ${unlock.slots}`;
    case 'dailyQuests':
      return 'daily quests';
    case 'greatCapsules':
      return 'Great capsules';
    case 'trainerTalent':
      return 'a trainer talent';
    case 'talentPoint':
      return `${unlock.count} talent ${unlock.count === 1 ? 'point' : 'points'}`;
  }
}

/** "Next: Lv 5 · team slot 3" from `nextUnlock(level)`, or null when nothing is left to unlock. */
export function nextUnlockText(level: number): string | null {
  const next = nextUnlock(level);
  if (!next) return null;
  return [`Next: Lv ${next.level}`, ...next.unlocks.map(unlockText)].join(' · ');
}

export type TeamSlotView =
  | { kind: 'member'; slot: number; owned: OwnedPokemon }
  | { kind: 'empty'; slot: number }
  | { kind: 'locked'; slot: number; unlockLevel: number | null };

/**
 * The hub's team strip, slot 1 → `MAX_TEAM_SLOTS`: team members (skipping ids that aren't owned),
 * then open empty slots up to `teamSlots(level)`, then locked slots with their unlock level.
 */
export function teamStrip(save: Pick<Save, 'team' | 'collection' | 'trainer'>): TeamSlotView[] {
  const open = teamSlots(save.trainer.level);
  const members = save.team.flatMap((id) => {
    const owned = save.collection[String(id)];
    return owned ? [owned] : [];
  });
  const out: TeamSlotView[] = [];
  for (let slot = 1; slot <= MAX_TEAM_SLOTS; slot++) {
    const owned = members[slot - 1];
    if (owned) out.push({ kind: 'member', slot, owned });
    else if (slot <= open) out.push({ kind: 'empty', slot });
    else out.push({ kind: 'locked', slot, unlockLevel: teamSlotUnlockLevel(slot) });
  }
  return out;
}
