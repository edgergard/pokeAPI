import { isLadderComplete, nextStageToFight, stageInfo } from '@/entities/ladder';
import { getSpecies } from '@/entities/pokemon';
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

export type RivalPreview = { speciesId: number; name: string; level: number; stars: number };

/** The hub's next-stage card: the stage to fight, its rival and first-clear reward, or "all cleared". */
export type NextStageView =
  | { complete: true; stage: number }
  | {
      complete: false;
      stage: number;
      rivalName: string;
      rival: RivalPreview[];
      /** "+1 Basic capsule · +20 dust". */
      firstClear: string;
    };

/** The next stage (`nextStageToFight`) with its rival preview; `complete` once every stage is cleared. */
export function nextStageView(save: Pick<Save, 'ladder'>): NextStageView {
  const stage = nextStageToFight(save);
  if (isLadderComplete(save)) return { complete: true, stage };
  const info = stageInfo(stage);
  return {
    complete: false,
    stage,
    rivalName: info.rivalName,
    rival: info.rival.map((m) => ({
      speciesId: m.speciesId,
      name: getSpecies(m.speciesId)?.name ?? `#${m.speciesId}`,
      level: m.level,
      stars: m.stars,
    })),
    firstClear: rewardParts(info.firstClear).join(' · '),
  };
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
