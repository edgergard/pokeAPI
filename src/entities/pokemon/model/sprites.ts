import { spriteUrl } from './typeColors';

/** Animated Showdown sprite (GIF) — available for generations 1–9; some alternate forms are missing. */
export const animatedSpriteUrl = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/${id}.gif`;

export type SpriteSource = 'animated' | 'static' | 'none';

type SpriteState = {
  /** The caller wants the animated sprite when motion allows it. */
  animated: boolean;
  /** Resolved motion setting (OS + in-app toggle). */
  motion: 'full' | 'reduced';
  gifFailed: boolean;
  staticFailed: boolean;
};

/**
 * Which picture a sprite shows. The GIF only plays with full motion and falls back to the static sprite;
 * reduced motion never shows the GIF, even when the static one failed (then nothing is shown).
 */
export function pickSpriteSource({
  animated,
  motion,
  gifFailed,
  staticFailed,
}: SpriteState): SpriteSource {
  if (animated && motion === 'full' && !gifFailed) return 'animated';
  if (!staticFailed) return 'static';
  return 'none';
}

export function spriteSrc(id: number, source: SpriteSource): string | null {
  if (source === 'animated') return animatedSpriteUrl(id);
  if (source === 'static') return spriteUrl(id);
  return null;
}
