// Public API of the capsule entity — other layers import only from here.
export { rollCapsule, openMany, rarityFromDraw } from './model/rollCapsule';
export { craftSpecies } from './model/craftSpecies';
export {
  craftPrice,
  dupesForNextStar,
  dustMissing,
  isOwned,
  isTierUnlocked,
  pityStatus,
  speciesRarity,
  tierLockReason,
  tierUnlockLevel,
  type PityStatus,
} from './model/helpers';
export {
  RARITY_BG_CLASS,
  RARITY_BORDER_CLASS,
  RARITY_LABEL,
  RARITY_TEXT_CLASS,
  TIER_LABEL,
  isCapsuleTier,
  maxRarity,
  rarityColor,
  rarityRank,
} from './model/rarity';
export {
  CapsuleError,
  type CapsuleErrorCode,
  type CapsuleResult,
  type CraftFailure,
  type CraftOutcome,
  type CraftResult,
  type OpenManyResult,
  type PityAfter,
  type PullOutcome,
  type RevealResult,
  type RollResult,
} from './model/types';
export { CapsuleArt } from './ui/CapsuleArt';
