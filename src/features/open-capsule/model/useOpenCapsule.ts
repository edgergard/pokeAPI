import { useCallback } from 'react';
import type { CapsuleTier } from '@/shared/config/economy';
import { commitCraft, commitOpen, type CraftCommit, type OpenCommit } from './commit';

/**
 * Open one capsule or every capsule of a tier. The result is saved before it is returned, so the caller
 * can animate the reveal freely: a reload mid-animation never re-rolls.
 */
export function useOpenCapsule(): {
  openOne: (tier: CapsuleTier) => OpenCommit;
  openAll: (tier: CapsuleTier) => OpenCommit;
} {
  const openOne = useCallback((tier: CapsuleTier) => commitOpen(tier, 1, Date.now()), []);
  const openAll = useCallback((tier: CapsuleTier) => commitOpen(tier, 'all', Date.now()), []);
  return { openOne, openAll };
}

/** Buy one unowned species with dust; the crafted Pokémon is saved before it is returned. */
export function useCraft(): { craft: (speciesId: number) => CraftCommit } {
  const craft = useCallback((speciesId: number) => commitCraft(speciesId, Date.now()), []);
  return { craft };
}
