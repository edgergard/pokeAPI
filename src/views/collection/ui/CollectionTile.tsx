import { useId, type CSSProperties } from 'react';
import Link from 'next/link';
import { Star } from 'lucide-react';
import {
  RARITY_FRAME,
  RARITY_LABEL,
  RARITY_TEXT_CLASS,
  craftPrice,
  rarityColor,
} from '@/entities/capsule';
import { typeColor, type Species } from '@/entities/pokemon';
import { talentPointsAvailable } from '@/entities/progression';
import type { OwnedPokemon } from '@/entities/save';
import { cn } from '@/shared/lib/cn';
import { formatDexNumber } from '@/shared/lib/format';
import { CreatureArt } from '@/widgets/capsule-reveal';

/** Accessible name of an owned tile: "Pikachu, level 12, 2 stars". */
export function ownedTileLabel(species: Species, owned: OwnedPokemon): string {
  const stars = `${owned.stars} ${owned.stars === 1 ? 'star' : 'stars'}`;
  return `${species.name}, level ${owned.level}, ${stars}`;
}

/** Description for the talent-point dot (the dot itself is visual only). */
export const TALENT_DOT_TEXT = 'Talent point to spend';

/** Accessible name of a missing tile: "Missing: Mewtwo". */
export const missingTileLabel = (species: Species) => `Missing: ${species.name}`;

export const creatureHref = (id: number) => `/creature/?id=${id}`;

/**
 * The tile is a list item whose name link stretches over the whole card (::after), so the grid reads as
 * a list of links. The art sits above that overlay but lets clicks through, except for its retry button
 * (a button can't live inside a link). Visible details duplicate the link name, so they are hidden from
 * assistive tech and passed as the link's description instead.
 */
const stretchedLink =
  'outline-none after:absolute after:inset-0 after:rounded-2xl focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-ring';

const artLayer = 'pointer-events-none absolute inset-0 z-10 [&_button]:pointer-events-auto';

export function OwnedTile({ species, owned }: { species: Species; owned: OwnedPokemon }) {
  const detailId = useId();
  const pointsId = useId();
  const color = typeColor(species.types[0]);
  const points = talentPointsAvailable(owned) > 0;

  return (
    <li data-species={species.id} data-owned="true">
      <div
        data-rarity={species.rarity}
        style={{ borderColor: rarityColor(species.rarity) } as CSSProperties}
        className={cn(
          'relative flex h-full flex-col gap-1.5 rounded-2xl bg-linear-160 from-card to-muted p-2.5 transition-[translate] duration-200 hover:-translate-y-0.5',
          RARITY_FRAME[species.rarity],
        )}
      >
        <div
          className="relative aspect-square w-full overflow-hidden rounded-xl"
          style={{
            background: `radial-gradient(circle at 50% 45%, color-mix(in oklab, ${color} 45%, transparent), color-mix(in oklab, ${color} 6%, transparent) 70%)`,
          }}
        >
          <div className={artLayer}>
            <CreatureArt
              speciesId={species.id}
              name={species.name}
              color={color}
              className="absolute inset-0 m-auto size-[88%] drop-shadow-[0_10px_14px_rgb(0_0_0/0.45)]"
            />
          </div>
          <span
            aria-hidden
            className="absolute bottom-1.5 left-1.5 rounded-full bg-background/80 px-2 py-0.5 font-mono text-xs text-foreground"
          >
            Lv {owned.level}
          </span>
          {points && (
            <span
              aria-hidden
              data-testid="talent-dot"
              className="absolute top-1.5 right-1.5 size-3 rounded-full bg-primary ring-2 ring-card"
            />
          )}
        </div>
        <Link
          href={creatureHref(species.id)}
          prefetch={false}
          aria-label={ownedTileLabel(species, owned)}
          aria-describedby={points ? `${detailId} ${pointsId}` : detailId}
          className={cn('truncate font-semibold text-card-foreground', stretchedLink)}
        >
          {species.name}
        </Link>
        <div aria-hidden className="flex items-center justify-between gap-2 text-xs">
          <span
            id={detailId}
            className={cn(
              'font-mono font-bold tracking-wider uppercase',
              RARITY_TEXT_CLASS[species.rarity],
            )}
          >
            {RARITY_LABEL[species.rarity]}
          </span>
          <span className="inline-flex items-center gap-0.5 font-mono text-foreground">
            <Star className="size-3.5 fill-primary text-primary" />
            {owned.stars}
          </span>
        </div>
        {points && (
          <span id={pointsId} hidden>
            {TALENT_DOT_TEXT}
          </span>
        )}
      </div>
    </li>
  );
}

export function MissingTile({ species }: { species: Species }) {
  const detailId = useId();
  const color = typeColor(species.types[0]);

  return (
    <li data-species={species.id} data-owned="false">
      <div className="relative flex h-full flex-col gap-1.5 rounded-2xl border-2 border-dashed border-border bg-muted/60 p-2.5 transition-[translate] duration-200 hover:-translate-y-0.5">
        <div
          className="relative aspect-square w-full overflow-hidden rounded-xl"
          style={{
            background: `radial-gradient(circle at 50% 45%, color-mix(in oklab, ${color} 30%, transparent), transparent 70%)`,
          }}
        >
          <div className={artLayer}>
            {/* A sprite is light enough for a page of silhouettes; brightness(0) turns it into one. */}
            <CreatureArt
              speciesId={species.id}
              name={species.name}
              color={color}
              kind="sprite"
              className="absolute inset-0 m-auto size-[80%] opacity-80 brightness-0 [image-rendering:pixelated]"
            />
          </div>
          <span
            aria-hidden
            className="absolute bottom-1.5 left-1.5 rounded-full bg-background/80 px-2 py-0.5 font-mono text-xs text-muted-foreground"
          >
            {formatDexNumber(species.id)}
          </span>
        </div>
        <Link
          href={creatureHref(species.id)}
          prefetch={false}
          aria-label={missingTileLabel(species)}
          aria-describedby={detailId}
          className={cn('truncate font-semibold text-muted-foreground', stretchedLink)}
        >
          {species.name}
        </Link>
        <p id={detailId} aria-hidden className="flex flex-col gap-0.5 text-xs">
          <span
            className={cn(
              'font-mono font-bold tracking-wider uppercase',
              RARITY_TEXT_CLASS[species.rarity],
            )}
          >
            {RARITY_LABEL[species.rarity]}
          </span>
          <span className="text-foreground">Craft · {craftPrice(species.rarity)} dust</span>
        </p>
      </div>
    </li>
  );
}

export function TileSkeleton() {
  return (
    <li aria-hidden className="flex flex-col gap-2 rounded-2xl bg-card p-2.5">
      <div className="shimmer relative aspect-square overflow-hidden rounded-xl bg-muted" />
      <div className="shimmer relative h-4 w-3/4 overflow-hidden rounded bg-muted" />
      <div className="shimmer relative h-3 w-1/2 overflow-hidden rounded bg-muted" />
    </li>
  );
}
