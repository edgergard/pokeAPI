import type { Save } from '@/entities/save';
import { CAPSULE_TIERS, type CapsuleTier, type Reward } from '@/shared/config/economy';
import { withPercent } from './math';
import { trainerBonuses } from './talentCatalog';

/** A reward as actually granted: every tier present, dust after the trainer `dustPercent` bonus. */
export type GrantedReward = { capsules: Record<CapsuleTier, number>; dust: number };

export function emptyReward(): GrantedReward {
  return {
    capsules: Object.fromEntries(CAPSULE_TIERS.map((t) => [t, 0])) as Record<CapsuleTier, number>,
    dust: 0,
  };
}

/** Adds two granted rewards (for summaries). */
export function sumRewards(a: GrantedReward, b: GrantedReward): GrantedReward {
  const out = emptyReward();
  for (const tier of CAPSULE_TIERS) out.capsules[tier] = a.capsules[tier] + b.capsules[tier];
  out.dust = a.dust + b.dust;
  return out;
}

/** What `grantReward(save, reward)` would add: capsules as given, dust with the trainer dust bonus (floor). */
export function effectiveReward(save: Pick<Save, 'trainer'>, reward: Reward): GrantedReward {
  const out = emptyReward();
  for (const tier of CAPSULE_TIERS) {
    out.capsules[tier] = Math.max(0, Math.floor(reward.capsules?.[tier] ?? 0));
  }
  const dust = Math.max(0, Math.floor(reward.dust ?? 0));
  out.dust = withPercent(dust, trainerBonuses(save.trainer.talents).dustPercent);
  return out;
}

/** Adds a reward to the save: capsules per tier, dust with the trainer `dustPercent` bonus (floor). */
export function grantReward(save: Save, reward: Reward): Save {
  const granted = effectiveReward(save, reward);
  if (granted.dust === 0 && CAPSULE_TIERS.every((t) => granted.capsules[t] === 0)) return save;
  const capsules = { ...save.capsules };
  for (const tier of CAPSULE_TIERS) capsules[tier] += granted.capsules[tier];
  return { ...save, capsules, dust: save.dust + granted.dust };
}
