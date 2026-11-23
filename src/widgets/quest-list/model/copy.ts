import { TIER_LABEL } from '@/entities/capsule';
import { CAPSULE_TIERS, type QuestKind, type Reward } from '@/shared/config/economy';

const HOUR_MS = 3_600_000;

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

/** The task line of a quest, built from its kind and target ("Win 3 battles"). */
export function questLabel(kind: QuestKind, target: number): string {
  switch (kind) {
    case 'battleWon':
      return `Win ${target} ${plural(target, 'battle', 'battles')}`;
    case 'capsuleOpened':
      return `Open ${target} ${plural(target, 'capsule', 'capsules')}`;
    case 'damageDealt':
      return `Deal ${target} damage`;
    case 'stageCleared':
      return `Clear ${target} ladder ${plural(target, 'stage', 'stages')}`;
    case 'pokemonLeveled':
      return `Gain ${target} Pokémon ${plural(target, 'level', 'levels')}`;
  }
}

/**
 * A reward as text parts, capsules first: ["+1 Basic capsule", "+20 dust"]. Accepts a pool reward
 * (`Reward`) or a granted one (every tier present); zero amounts are left out.
 */
export function rewardParts(reward: Reward): string[] {
  const parts: string[] = [];
  for (const tier of CAPSULE_TIERS) {
    const count = reward.capsules?.[tier] ?? 0;
    if (count > 0) {
      parts.push(`+${count} ${TIER_LABEL[tier]} ${plural(count, 'capsule', 'capsules')}`);
    }
  }
  if (reward.dust && reward.dust > 0) parts.push(`+${reward.dust} dust`);
  return parts;
}

/** Whole hours from `now` until `at`, rounded up (at least 1 while `at` is ahead). */
export function hoursUntil(at: number, now: number): number {
  return Math.max(1, Math.ceil((at - now) / HOUR_MS));
}

/** "06:00" for a local refresh hour. */
export function refillTime(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}
