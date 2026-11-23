import type { Save } from '@/entities/save';
import { economy, type QuestKind, type Reward } from '@/shared/config/economy';
import { nextRefreshAt, questDay } from './day';
import { getQuestDefinition, poolIndex } from './pool';
import { questsLocked } from './refresh';

/** One quest with its pool data, for the hub's quest list. */
export type QuestRow = {
  id: string;
  /** Quest day it was issued on (identifies it together with `id`). */
  day: string;
  kind: QuestKind;
  progress: number;
  target: number;
  /** Pool reward (before the trainer dust bonus; `effectiveReward` gives the granted value). */
  reward: Reward;
  finished: boolean;
  claimed: boolean;
  /** Finished and not claimed yet. */
  claimable: boolean;
};

/** Active quests with pool data, oldest day first, then pool order. Unknown pool ids are skipped. */
export function questRows(save: Pick<Save, 'quests'>): QuestRow[] {
  const rows: QuestRow[] = [];
  for (const quest of save.quests.active) {
    const definition = getQuestDefinition(quest.id);
    if (!definition) continue;
    const finished = quest.progress >= quest.target;
    rows.push({
      id: quest.id,
      day: quest.day,
      kind: definition.kind,
      progress: quest.progress,
      target: quest.target,
      reward: definition.reward,
      finished,
      claimed: quest.claimed,
      claimable: finished && !quest.claimed,
    });
  }
  return rows.sort((a, b) =>
    a.day === b.day ? poolIndex(a.id) - poolIndex(b.id) : a.day < b.day ? -1 : 1,
  );
}

/**
 * What the hub's quest card shows. Call after `refreshQuests(save, now)`.
 * - `locked`: "Daily quests unlock at Trainer Lv 2"
 * - `allClaimed` (nothing left to do, also when empty): "No quests right now. New quests in 5 h"
 * - `clockBehind`: the clock moved back — show "Quests refill at 06:00" instead of a countdown
 */
export type QuestBoard =
  | { state: 'locked'; unlockLevel: number }
  | {
      state: 'open' | 'allClaimed';
      rows: QuestRow[];
      /** Quests ready to claim. */
      claimable: number;
      today: string;
      nextRefreshAt: number;
      clockBehind: boolean;
      /** Local hour quests refill (`economy.quests.refreshHour`). */
      refreshHour: number;
    };

export function questBoard(
  save: Pick<Save, 'quests' | 'trainer' | 'meta'>,
  now: number,
): QuestBoard {
  if (questsLocked(save)) {
    return { state: 'locked', unlockLevel: economy.trainer.unlocks.dailyQuests };
  }
  const rows = questRows(save);
  return {
    state: rows.some((r) => !r.claimed) ? 'open' : 'allClaimed',
    rows,
    claimable: rows.filter((r) => r.claimable).length,
    today: questDay(now),
    nextRefreshAt: nextRefreshAt(now),
    clockBehind: now < save.meta.maxSeenTime,
    refreshHour: economy.quests.refreshHour,
  };
}

/** Number of quests ready to claim (nav / hub badge). */
export function claimableQuestCount(save: Pick<Save, 'quests'>): number {
  return questRows(save).filter((r) => r.claimable).length;
}
