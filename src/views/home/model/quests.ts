import type { ClaimQuestResult } from '@/entities/quest';
import { rewardParts } from '@/widgets/quest-list';

/** What a claim announces: "+30 dust · +80 Trainer XP", plus "Trainer Lv 3" on a level-up. */
export function claimAnnouncement(result: Extract<ClaimQuestResult, { ok: true }>): string {
  const parts = [...rewardParts(result.reward), `+${result.trainerXp} Trainer XP`];
  if (result.levelsGained > 0) parts.push(`Trainer Lv ${result.save.trainer.level}`);
  return parts.join(' · ');
}
