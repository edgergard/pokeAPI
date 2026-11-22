import type { Quest, Save } from '@/entities/save';
import { economy } from '@/shared/config/economy';
import { createRng, hashSeed } from '@/shared/lib/rng';
import { dayLabel, dayNumber, questDay } from './day';

/** The `economy.quests.dailyCount` distinct quests of one quest day — deterministic per seed and day. */
export function pickDailyQuests(seed: number, day: string): Quest[] {
  const rng = createRng(hashSeed(seed, 'quests', day));
  const remaining = [...economy.quests.pool];
  const out: Quest[] = [];
  const count = Math.min(economy.quests.dailyCount, remaining.length);
  for (let i = 0; i < count; i++) {
    const [entry] = remaining.splice(Math.floor(rng() * remaining.length), 1);
    if (entry) out.push({ id: entry.id, progress: 0, target: entry.target, day, claimed: false });
  }
  return out;
}

/** Whether daily quests are still locked by trainer level. */
export function questsLocked(save: Pick<Save, 'trainer'>): boolean {
  return save.trainer.level < economy.trainer.unlocks.dailyQuests;
}

/**
 * Issues the daily quests due at `now` and drops expired ones. Call on app focus / hub load.
 * - Clock guard: `now` before `meta.maxSeenTime` → the save comes back unchanged (no punishment).
 * - Locked below trainer Lv `economy.trainer.unlocks.dailyQuests`.
 * - Every quest day after `quests.lastIssuedDay` up to today, but only the last `maxStockDays` days,
 *   gets `dailyCount` quests (the first issue ever covers today only).
 * - Drops claimed quests of earlier days and quests `maxStockDays` or more days old.
 * Idempotent: the same `now` twice gives the same save (the same object when nothing changed).
 */
export function refreshQuests(save: Save, now: number): Save {
  if (now < save.meta.maxSeenTime) return save;
  const seen = Math.floor(now);
  let next: Save =
    seen > save.meta.maxSeenTime ? { ...save, meta: { ...save.meta, maxSeenTime: seen } } : save;
  if (questsLocked(save)) return next;

  const today = questDay(now);
  const todayNum = dayNumber(today);
  if (todayNum === null) return next;
  const oldestLive = todayNum - economy.quests.maxStockDays + 1;
  const last = save.quests.lastIssuedDay;
  const lastNum = last === null ? null : dayNumber(last);
  const from = Math.max(lastNum === null ? todayNum : lastNum + 1, oldestLive);

  const kept = save.quests.active.filter((q) => {
    const n = dayNumber(q.day);
    if (n === null) return true;
    if (n < oldestLive) return false;
    return !(q.claimed && n < todayNum);
  });
  const issued: Quest[] = [];
  for (let n = from; n <= todayNum; n++)
    issued.push(...pickDailyQuests(save.meta.seed, dayLabel(n)));
  const lastIssuedDay = from <= todayNum ? today : last;

  if (
    issued.length > 0 ||
    kept.length !== save.quests.active.length ||
    lastIssuedDay !== save.quests.lastIssuedDay
  ) {
    next = { ...next, quests: { active: [...kept, ...issued], lastIssuedDay } };
  }
  return next;
}
