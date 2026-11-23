import { getTrainerTalent, type TrainerUnlock } from '@/entities/progression';

/**
 * The unlock list of a level-up ("Team slot 2 · Daily quests · 1 talent point"). Several levels at
 * once are merged: talent points are summed and listed last, everything else keeps its order.
 */
export function unlockLines(unlocks: readonly TrainerUnlock[]): string[] {
  const lines: string[] = [];
  let points = 0;
  for (const unlock of unlocks) {
    switch (unlock.kind) {
      case 'teamSlot':
        lines.push(`Team slot ${unlock.slots}`);
        break;
      case 'dailyQuests':
        lines.push('Daily quests');
        break;
      case 'greatCapsules':
        lines.push('Great capsules');
        break;
      case 'trainerTalent':
        lines.push(`New talent: ${getTrainerTalent(unlock.id)?.name ?? unlock.id}`);
        break;
      case 'talentPoint':
        points += unlock.count;
        break;
    }
  }
  if (points > 0) lines.push(`${points} talent point${points === 1 ? '' : 's'}`);
  return lines;
}

/** The level-up's contextual primary action. */
export type LevelUpAction =
  { kind: 'fillSlot'; slot: number; label: string } | { kind: 'link'; href: string; label: string };

/**
 * A new team slot first ("Fill slot N", the highest slot unlocked), then daily quests ("See quests",
 * on Home), otherwise "Learn talent" (Trainer screen) — every level from the talent level on brings
 * a point.
 */
export function primaryAction(unlocks: readonly TrainerUnlock[]): LevelUpAction {
  let slot = 0;
  for (const unlock of unlocks) {
    if (unlock.kind === 'teamSlot') slot = Math.max(slot, unlock.slots);
  }
  if (slot > 0) return { kind: 'fillSlot', slot, label: `Fill slot ${slot}` };
  if (unlocks.some((u) => u.kind === 'dailyQuests')) {
    return { kind: 'link', href: '/', label: 'See quests' };
  }
  return { kind: 'link', href: '/trainer/', label: 'Learn talent' };
}
