import { CAPSULE_TIERS, RARITIES, type CapsuleTier, type Rarity } from '@/shared/config/economy';

/** 0 = common … 4 = legendary (order of `RARITIES`). */
export function rarityRank(rarity: Rarity): number {
  return RARITIES.indexOf(rarity);
}

/** The rarer of two rarities. */
export function maxRarity(a: Rarity, b: Rarity): Rarity {
  return rarityRank(a) >= rarityRank(b) ? a : b;
}

export const RARITY_LABEL: Record<Rarity, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
  epic: 'Epic',
  legendary: 'Legendary',
};

export const TIER_LABEL: Record<CapsuleTier, string> = {
  basic: 'Basic',
  great: 'Great',
};

/** Literal class names (Tailwind only sees complete strings). Always pair the colour with a text label. */
export const RARITY_TEXT_CLASS: Record<Rarity, string> = {
  common: 'text-rarity-common',
  uncommon: 'text-rarity-uncommon',
  rare: 'text-rarity-rare',
  epic: 'text-rarity-epic',
  legendary: 'text-rarity-legendary',
};

export const RARITY_BG_CLASS: Record<Rarity, string> = {
  common: 'bg-rarity-common',
  uncommon: 'bg-rarity-uncommon',
  rare: 'bg-rarity-rare',
  epic: 'bg-rarity-epic',
  legendary: 'bg-rarity-legendary',
};

export const RARITY_BORDER_CLASS: Record<Rarity, string> = {
  common: 'border-rarity-common',
  uncommon: 'border-rarity-uncommon',
  rare: 'border-rarity-rare',
  epic: 'border-rarity-epic',
  legendary: 'border-rarity-legendary',
};

/**
 * Frame shape per rarity: the non-colour cue next to the text label (design.md Accessibility: "форма
 * рамки"). Thin → thick → double → double + dashed ring → wide double + solid ring. Colour comes from the
 * caller (border colour); the outer ring carries the rarity colour itself.
 */
export const RARITY_FRAME: Record<Rarity, string> = {
  common: 'border-2 border-solid',
  uncommon: 'border-4 border-solid',
  rare: 'border-4 border-double',
  epic: 'border-4 border-double outline-2 outline-offset-2 outline-dashed outline-rarity-epic',
  legendary:
    'border-[6px] border-double outline-2 outline-offset-[3px] outline-solid outline-rarity-legendary',
};

/** CSS colour value of a rarity token, for inline styles (glows, gradients). */
export const rarityColor = (rarity: Rarity): string => `var(--color-rarity-${rarity})`;

export function isCapsuleTier(value: unknown): value is CapsuleTier {
  return typeof value === 'string' && (CAPSULE_TIERS as readonly string[]).includes(value);
}
