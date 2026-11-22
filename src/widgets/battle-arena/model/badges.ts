import type { TalentBranch } from '@/entities/progression';

/** Talent branches in display order (the creature screen's talent tree columns). */
export const TALENT_BRANCHES: readonly TalentBranch[] = ['offense', 'defense', 'tempo'];

/** Learned talents per branch, in display order; branches without talents are left out. */
export function talentTally(talents: readonly TalentBranch[]): [TalentBranch, number][] {
  return TALENT_BRANCHES.map((b): [TalentBranch, number] => [
    b,
    talents.filter((t) => t === b).length,
  ]).filter(([, n]) => n > 0);
}
