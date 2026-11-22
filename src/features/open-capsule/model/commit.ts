import {
  craftSpecies,
  openMany,
  type CapsuleResult,
  type CraftFailure,
  type CraftResult,
} from '@/entities/capsule';
import { applyGameEvents, getSave, updateSave } from '@/entities/save';
import type { CapsuleTier } from '@/shared/config/economy';

/** Why an open did not happen. The view shows "Couldn't open. Try again" for both. */
export type OpenError = 'notLoaded' | 'failed';

export type OpenCommit = { ok: true; results: CapsuleResult[] } | { ok: false; error: OpenError };

/**
 * Rolls `count` capsules (or every capsule of the tier) and commits the new save — with the
 * `capsuleOpened` events applied — in one `updateSave`, before anything animates. The results are
 * captured inside the updater, so the reveal shows exactly what was saved.
 */
export function commitOpen(tier: CapsuleTier, count: number | 'all', now: number): OpenCommit {
  if (!getSave()) return { ok: false, error: 'notLoaded' };
  const captured: { results?: CapsuleResult[] } = {};
  try {
    updateSave((save) => {
      const n = count === 'all' ? save.capsules[tier] : count;
      const roll = openMany(save, tier, n, now);
      captured.results = roll.results;
      return applyGameEvents(roll.save, roll.events);
    });
  } catch {
    // Nothing was committed: updateSave only emits after the updater returns.
    return { ok: false, error: 'failed' };
  }
  return captured.results
    ? { ok: true, results: captured.results }
    : { ok: false, error: 'failed' };
}

export type CraftCommit =
  { ok: true; result: CraftResult } | CraftFailure | { ok: false; reason: 'notLoaded' | 'failed' };

/** Crafts one unowned species with dust and commits it (crafting emits no game event). */
export function commitCraft(speciesId: number, now: number): CraftCommit {
  if (!getSave()) return { ok: false, reason: 'notLoaded' };
  const captured: { outcome?: ReturnType<typeof craftSpecies> } = {};
  try {
    updateSave((save) => {
      const craft = craftSpecies(save, speciesId, now);
      captured.outcome = craft;
      // A refused craft returns the same save, which updateSave treats as a no-op.
      return craft.ok ? craft.save : save;
    });
  } catch {
    return { ok: false, reason: 'failed' };
  }
  const { outcome } = captured;
  if (!outcome) return { ok: false, reason: 'failed' };
  return outcome.ok ? { ok: true, result: outcome.result } : outcome;
}
