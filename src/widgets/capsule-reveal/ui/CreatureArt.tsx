import { useState } from 'react';
import { RotateCw } from 'lucide-react';
import { getCreatureArt, type ArtKind } from '@/entities/pokemon';
import { cn } from '@/shared/lib/cn';

type Props = {
  speciesId: number;
  name: string;
  /** Type colour for the fallback silhouette. */
  color: string;
  kind?: ArtKind;
  className?: string;
  /** Hides the retry button (e.g. on a face-down card). */
  interactive?: boolean;
};

/** Creature art with a type-coloured silhouette and a retry button when the image fails to load. */
export function CreatureArt({
  speciesId,
  name,
  color,
  kind = 'artwork',
  className,
  interactive = true,
}: Props) {
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className={cn('relative grid place-items-center', className)}>
        <div
          aria-hidden
          className="aspect-square w-1/2 rounded-full opacity-80 blur-[1px]"
          style={{ background: `radial-gradient(circle at 40% 35%, white -40%, ${color} 60%)` }}
        />
        {interactive && (
          <button
            type="button"
            onClick={() => {
              setFailed(false);
              setAttempt((a) => a + 1);
            }}
            aria-label={`Retry loading ${name} image`}
            className="tap-target absolute right-2 bottom-2 grid size-9 cursor-pointer place-items-center rounded-full border border-input bg-background/80 text-foreground transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <RotateCw className="size-4" aria-hidden />
          </button>
        )}
      </div>
    );
  }

  return (
    // Keyed by attempt: a retry remounts the image, which requests it again.
    <img
      key={attempt}
      src={getCreatureArt(speciesId, kind)}
      alt=""
      draggable={false}
      onError={() => setFailed(true)}
      className={cn('object-contain', className)}
    />
  );
}
