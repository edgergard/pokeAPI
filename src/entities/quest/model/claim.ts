import {
  addTrainerXp,
  effectiveReward,
  grantReward,
  type GrantedReward,
  type TrainerUnlock,
} from '@/entities/progression';
import { applyGameEvents, type GameEvent, type Save } from '@/entities/save';
import { economy } from '@/shared/config/economy';
import { getQuestDefinition } from './pool';

export type ClaimQuestFailure = 'notFound' | 'notFinished' | 'alreadyClaimed';

export type ClaimQuestResult =
  | {
      ok: true;
      save: Save;
      /** What was granted (dust after the trainer dust bonus). */
      reward: GrantedReward;
      trainerXp: number;
      levelsGained: number;
      /** Unlocks of every trainer level gained (level-up dialog). */
      unlocks: TrainerUnlock[];
      talentPointsGained: number;
    }
  | { ok: false; reason: ClaimQuestFailure };

/**
 * Claims a finished daily quest, identified by pool `id` + quest `day`: grants the pool reward and
 * `economy.quests.trainerXp`, marks it claimed and folds `trainerLeveled` events in.
 */
export function claimQuest(save: Save, questId: string, day: string): ClaimQuestResult {
  const index = save.quests.active.findIndex((q) => q.id === questId && q.day === day);
  const quest = save.quests.active[index];
  const definition = getQuestDefinition(questId);
  if (!quest || !definition) return { ok: false, reason: 'notFound' };
  if (quest.claimed) return { ok: false, reason: 'alreadyClaimed' };
  if (quest.progress < quest.target) return { ok: false, reason: 'notFinished' };

  const reward = effectiveReward(save, definition.reward);
  const trainerXp = economy.quests.trainerXp;
  const leveled = addTrainerXp(grantReward(save, definition.reward), trainerXp);
  let next = leveled.save;
  next = {
    ...next,
    quests: {
      ...next.quests,
      active: next.quests.active.map((q, i) => (i === index ? { ...q, claimed: true } : q)),
    },
  };
  const events: GameEvent[] = [];
  for (let level = save.trainer.level + 1; level <= next.trainer.level; level++) {
    events.push({ kind: 'trainerLeveled', level });
  }
  next = applyGameEvents(next, events);

  return {
    ok: true,
    save: next,
    reward,
    trainerXp,
    levelsGained: leveled.levelsGained,
    unlocks: leveled.unlocks,
    talentPointsGained: leveled.talentPointsGained,
  };
}
