import type { GameEventReducer } from '@/entities/save';
import { getQuestDefinition } from './pool';

/**
 * Folds a game event into daily-quest progress: every unclaimed, unfinished active quest whose pool
 * `kind` matches advances (`damageDealt` by its amount, everything else by 1), clamped at `target`.
 * Returns the same save when nothing changed. SaveProvider registers it (not this module).
 */
export const questEventReducer: GameEventReducer = (save, event) => {
  const step = event.kind === 'damageDealt' ? event.amount : 1;
  if (!(step > 0)) return save;
  let changed = false;
  const active = save.quests.active.map((quest) => {
    if (quest.claimed || quest.progress >= quest.target) return quest;
    if (getQuestDefinition(quest.id)?.kind !== event.kind) return quest;
    changed = true;
    return { ...quest, progress: Math.min(quest.target, quest.progress + step) };
  });
  return changed ? { ...save, quests: { ...save.quests, active } } : save;
};
