import { useState } from 'react';
import { getCreatureArt, getSpecies, typeColor, type ArtKind } from '@/entities/pokemon';
import { cn } from '@/shared/lib/cn';

/**
 * Creature art for the team dialog (via `getCreatureArt`). When the image fails, a type-coloured
 * silhouette stands in; it is decorative (the slot or row carries the name), so no retry control.
 */
export function PokemonArt({
  speciesId,
  kind = 'sprite',
  className,
}: {
  speciesId: number;
  kind?: ArtKind;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    const color = typeColor(getSpecies(speciesId)?.types[0]);
    return (
      <span aria-hidden className={cn('grid place-items-center', className)}>
        <span
          className="aspect-square w-3/5 rounded-full opacity-80"
          style={{ background: `radial-gradient(circle at 40% 35%, white -40%, ${color} 60%)` }}
        />
      </span>
    );
  }
  return (
    <img
      src={getCreatureArt(speciesId, kind)}
      alt=""
      loading="lazy"
      draggable={false}
      onError={() => setFailed(true)}
      className={cn(
        'object-contain',
        kind === 'sprite' && '[image-rendering:pixelated]',
        className,
      )}
    />
  );
}
