import type { GameEvent, Save } from '@/entities/save';
import type { CapsuleTier, Rarity } from '@/shared/config/economy';

/** What a pull did to the collection. */
export type PullOutcome =
  /** A species the player did not own: added at ★1. */
  | 'new'
  /** A duplicate that completed the next star. */
  | 'starUp'
  /** A duplicate that counts towards the next star. */
  | 'dupe'
  /** A duplicate at max stars: converted to dust. */
  | 'dust';

/** Pity of one tier right after an open. */
export type PityAfter = {
  tier: CapsuleTier;
  /** The rarity the pity guarantees (economy.capsules.pity[tier].rarity). */
  rarity: Rarity;
  /** Opens per guarantee (economy.capsules.pity[tier].opens). */
  opens: number;
  /** save.pity[tier] after this open: opens since the pity rarity (or better) last dropped. */
  count: number;
  /** Opens until the guarantee, counting the guaranteed one (≥ 1). */
  left: number;
  /** True when this open dropped the pity rarity or better and reset the counter. */
  reset: boolean;
};

/** Everything the reveal shows for one opened capsule — computed once, never recomputed by the UI. */
export type CapsuleResult = {
  kind: 'capsule';
  tier: CapsuleTier;
  /** `meta.pullIndex` this pull was seeded with. */
  pullIndex: number;
  rarity: Rarity;
  speciesId: number;
  outcome: PullOutcome;
  /** Level of the owned Pokémon (1 when new; a pull never changes it). */
  level: number;
  /** Stars of the species after this pull. */
  stars: number;
  /** Duplicates towards the next star after this pull. */
  dupes: number;
  /** Duplicates the next star needs (0 at max stars). */
  dupesForNextStar: number;
  dustGained: number;
  pity: PityAfter;
  /** The very first capsule of the save (economy.capsules.firstCapsuleMinRarity applied). */
  firstCapsule: boolean;
  /** Which floor raised the rolled rarity, if any. */
  raisedBy: 'pity' | 'first' | null;
};

/** A species bought with dust. Shown with the same reveal as a capsule (single card, "New!"). */
export type CraftResult = {
  kind: 'craft';
  rarity: Rarity;
  speciesId: number;
  outcome: 'new';
  level: number;
  stars: number;
  dupes: number;
  dupesForNextStar: number;
  dustGained: 0;
  /** Dust spent. */
  price: number;
};

/** One card the reveal can show. */
export type RevealResult = CapsuleResult | CraftResult;

export type RollResult = { save: Save; result: CapsuleResult; events: GameEvent[] };

export type OpenManyResult = { save: Save; results: CapsuleResult[]; events: GameEvent[] };

export type CapsuleErrorCode = 'noCapsules' | 'locked' | 'badCount' | 'noSpecies';

/** Thrown by `rollCapsule` / `openMany` for an open the UI should never offer. */
export class CapsuleError extends Error {
  readonly code: CapsuleErrorCode;
  constructor(code: CapsuleErrorCode, message: string) {
    super(message);
    this.name = 'CapsuleError';
    this.code = code;
  }
}

export type CraftFailure =
  | { ok: false; reason: 'unknownSpecies' }
  | { ok: false; reason: 'owned' }
  | { ok: false; reason: 'notEnoughDust'; price: number; missing: number };

export type CraftOutcome = { ok: true; save: Save; result: CraftResult } | CraftFailure;
