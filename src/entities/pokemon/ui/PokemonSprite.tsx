import { useState } from 'react';
import { cn } from '@/shared/lib/cn';
import { usePrefersReducedMotion } from '@/shared/lib/motion';
import { pickSpriteSource, spriteSrc } from '../model/sprites';

type Props = {
  id: number;
  /** Play the animated Showdown GIF when motion is on (static sprite otherwise). */
  animated?: boolean;
  /** Flip horizontally (front sprites face left). Uses the `scale` property, so `transform` stays free. */
  mirrored?: boolean;
  /** Box size in px (a size class in `className` overrides it); the picture is fitted inside. */
  size?: number;
  alt?: string;
  className?: string;
};

/** A Pokémon sprite that never shows a broken-image icon: GIF → static PNG → an empty box of the same size. */
export function PokemonSprite(props: Props) {
  // Keyed by id: a new Pokémon starts with fresh error flags.
  return <SpriteImage key={props.id} {...props} />;
}

function SpriteImage({ id, animated = true, mirrored = false, size = 64, alt = '', className }: Props) {
  const reduced = usePrefersReducedMotion();
  const [gifFailed, setGifFailed] = useState(false);
  const [staticFailed, setStaticFailed] = useState(false);

  const source = pickSpriteSource({ animated, motion: reduced ? 'reduced' : 'full', gifFailed, staticFailed });
  const src = spriteSrc(id, source);

  // Width/height attributes are presentational hints: a size class from the caller overrides them.
  if (!src) return <svg aria-hidden width={size} height={size} className={cn('shrink-0', className)} />;

  return (
    <img
      key={source}
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => (source === 'animated' ? setGifFailed(true) : setStaticFailed(true))}
      className={cn(
        'shrink-0 select-none',
        // GIFs are tightly cropped pixel art of varying size: never upscaled (no blur), so relative sizes
        // stay true. The PNG is a padded 96px canvas, contained; nearest-neighbour only at whole multiples
        // of 96 (a fractional reduction would drop pixel rows), smooth scaling otherwise.
        source === 'animated' ? 'object-scale-down' : 'object-contain',
        source === 'static' && size >= 96 && size % 96 === 0 && '[image-rendering:pixelated]',
        className,
      )}
      style={mirrored ? { scale: '-1 1' } : undefined}
    />
  );
}
