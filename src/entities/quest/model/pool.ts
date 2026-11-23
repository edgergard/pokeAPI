import { economy } from '@/shared/config/economy';

/** One entry of `economy.quests.pool`. */
export type QuestDefinition = (typeof economy.quests.pool)[number];

const byId = new Map<string, QuestDefinition>(economy.quests.pool.map((q) => [q.id, q]));

export function getQuestDefinition(id: string): QuestDefinition | undefined {
  return byId.get(id);
}

/** Pool order of a quest id (for stable sorting); unknown ids sort last. */
export function poolIndex(id: string): number {
  const index = economy.quests.pool.findIndex((q) => q.id === id);
  return index === -1 ? economy.quests.pool.length : index;
}
