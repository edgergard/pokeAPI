'use client';

import { useState, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { Lock, Plus, RotateCw } from 'lucide-react';
import {
  RARITY_BORDER_CLASS,
  RARITY_FRAME,
  RARITY_LABEL,
  RARITY_TEXT_CLASS,
} from '@/entities/capsule';
import { getCreatureArt, getSpecies, typeColor } from '@/entities/pokemon';
import { cn } from '@/shared/lib/cn';
import { formatName } from '@/shared/lib/format';
import { usePointerTilt } from '@/shared/lib/usePointerTilt';

/** A label on the card's top edge instead of the rarity (onboarding: "Loaner", "Rival"). */
export type HoloTag = { label: string; tone: 'loaner' | 'rival' };

type CreatureProps = {
  variant: 'large' | 'mini';
  speciesId: number;
  level: number;
  /** ★ count; omitted for cards that aren't owned (loaner, rival). */
  stars?: number;
  tag?: HoloTag;
  /** Unspent talent points (shows a dot and says so in the label). */
  talentPoints?: number;
  /** Makes the card a link (e.g. `/creature/?id=25`). */
  href?: string;
  className?: string;
};

type SlotProps =
  | { variant: 'locked'; slot: number; unlockLevel: number | null; className?: string }
  | { variant: 'slot'; slot: number; className?: string };

export type HoloCardProps = CreatureProps | SlotProps;

const TAG_CLASS: Record<HoloTag['tone'], string> = {
  loaner: 'text-rarity-uncommon',
  rival: 'text-side-red',
};
const TAG_BORDER: Record<HoloTag['tone'], string> = {
  loaner: 'border-rarity-uncommon',
  rival: 'border-side-red',
};

/**
 * The game's holo card (design.md component `HoloCard`): large (onboarding), mini (hub team strip),
 * an open empty slot, or a locked slot with its unlock reason. Art comes from `getCreatureArt` with a
 * type-coloured silhouette and a retry button when it fails; rarity is always named in text.
 */
export function HoloCard(props: HoloCardProps) {
  if (props.variant === 'locked') {
    return (
      <div
        role="group"
        aria-label={
          props.unlockLevel === null
            ? `Slot ${props.slot}, locked`
            : `Slot ${props.slot}, unlocks at Trainer level ${props.unlockLevel}`
        }
        data-slot-state="locked"
        className={cn(
          'flex min-h-40 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-input/60 bg-muted/60 p-4 text-center',
          props.className,
        )}
      >
        <Lock aria-hidden className="size-5 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground">
          {props.unlockLevel === null ? 'Locked' : `Unlocks at Trainer Lv ${props.unlockLevel}`}
        </span>
      </div>
    );
  }
  if (props.variant === 'slot') {
    return (
      <div
        role="group"
        aria-label={`Slot ${props.slot}, empty`}
        data-slot-state="empty"
        className={cn(
          'flex min-h-40 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-input/60 p-4 text-center',
          props.className,
        )}
      >
        <Plus aria-hidden className="size-5 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground">Empty slot</span>
      </div>
    );
  }
  return <CreatureCard {...props} />;
}

/** Accessible summary: "Pikachu, level 7, 1 star, Uncommon, 1 talent point available". */
export function holoCardLabel({
  name,
  level,
  stars,
  rarity,
  tag,
  talentPoints = 0,
}: {
  name: string;
  level: number;
  stars?: number;
  rarity?: string;
  tag?: HoloTag;
  talentPoints?: number;
}): string {
  const parts = [name];
  if (tag) parts.push(tag.label.toLowerCase());
  parts.push(`level ${level}`);
  if (stars !== undefined) parts.push(`${stars} ${stars === 1 ? 'star' : 'stars'}`);
  if (rarity) parts.push(rarity);
  if (talentPoints > 0) {
    parts.push(`${talentPoints} talent ${talentPoints === 1 ? 'point' : 'points'} available`);
  }
  return parts.join(', ');
}

function CreatureCard({
  variant,
  speciesId,
  level,
  stars,
  tag,
  talentPoints = 0,
  href,
  className,
}: CreatureProps) {
  const species = getSpecies(speciesId);
  const name = species?.name ?? `#${speciesId}`;
  const color = typeColor(species?.types[0]);
  const rarity = species?.rarity;
  const rarityLabel = rarity ? RARITY_LABEL[rarity] : undefined;
  const large = variant === 'large';
  const tiltRef = usePointerTilt<HTMLDivElement>();
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  const label = holoCardLabel({ name, level, stars, rarity: rarityLabel, tag, talentPoints });

  const frame = tag
    ? cn('border-2', TAG_BORDER[tag.tone])
    : rarity
      ? cn(RARITY_FRAME[rarity], RARITY_BORDER_CLASS[rarity])
      : 'border-2 border-border';

  const face: ReactNode = (
    <>
      <div className="flex items-center justify-between gap-2">
        {tag ? (
          <span
            className={cn(
              'min-w-0 truncate font-mono text-xs font-bold uppercase',
              large ? 'tracking-[0.12em]' : 'tracking-wide',
              TAG_CLASS[tag.tone],
            )}
          >
            {tag.label}
          </span>
        ) : (
          rarity && (
            <span
              className={cn(
                'min-w-0 truncate font-mono text-xs font-bold uppercase',
                large ? 'tracking-[0.12em]' : 'tracking-wide',
                RARITY_TEXT_CLASS[rarity],
              )}
            >
              {rarityLabel}
            </span>
          )
        )}
        <span className="shrink-0 font-mono text-xs font-bold whitespace-nowrap text-foreground">
          Lv {level}
        </span>
      </div>
      <div
        aria-hidden
        className={cn(
          'relative overflow-hidden rounded-xl bg-secondary',
          large ? 'aspect-square' : 'aspect-[5/4]',
        )}
        style={{
          backgroundImage: `radial-gradient(circle at 50% 45%, color-mix(in oklab, ${color} 45%, transparent), transparent 70%)`,
        }}
      >
        {failed ? (
          <div
            data-art="silhouette"
            className="absolute inset-0 m-auto aspect-square w-1/2 rounded-full opacity-80"
            style={{ background: `radial-gradient(circle at 40% 35%, white -40%, ${color} 60%)` }}
          />
        ) : (
          <img
            key={attempt}
            src={getCreatureArt(speciesId, 'artwork')}
            alt=""
            draggable={false}
            loading={large ? 'eager' : 'lazy'}
            onError={() => setFailed(true)}
            className="absolute inset-0 m-auto h-[86%] object-contain drop-shadow-[0_14px_18px_rgb(0_0_0/0.45)]"
          />
        )}
        {talentPoints > 0 && (
          <span className="absolute top-2 right-2 size-3 rounded-full bg-primary ring-2 ring-card" />
        )}
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <span
          className={cn(
            'truncate font-display font-extrabold tracking-tight text-foreground',
            large ? 'text-2xl' : 'text-base',
          )}
        >
          {name}
        </span>
        {stars !== undefined && (
          <span aria-hidden className="shrink-0 text-sm text-primary">
            {'★'.repeat(stars)}
          </span>
        )}
      </div>
      {large && species && (
        <div className="flex flex-wrap gap-1.5">
          {species.types.map((type) => (
            <span
              key={type}
              className="rounded-full px-2.5 py-0.5 text-xs font-semibold text-background"
              style={{ background: typeColor(type) }}
            >
              {formatName(type)}
            </span>
          ))}
        </div>
      )}
    </>
  );

  return (
    <div
      data-species={speciesId}
      className={cn('relative', large ? 'w-full max-w-64' : 'w-full', className)}
    >
      <div
        ref={tiltRef}
        role={href ? undefined : 'img'}
        aria-label={href ? undefined : label}
        className={cn('card-tilt relative overflow-hidden rounded-2xl bg-card', frame)}
        style={{ '--type': color } as CSSProperties}
      >
        <div
          aria-hidden={href ? true : undefined}
          className={cn('flex flex-col', large ? 'gap-3 p-4' : 'gap-2 p-3')}
        >
          {face}
        </div>
        {/* Pointer-tracked glare + type-tinted foil (styles.css `.holo`), visible only while tilting. */}
        <div aria-hidden className="holo pointer-events-none absolute inset-0 z-10" />
        {href && (
          <Link
            href={href}
            aria-label={label}
            className="absolute inset-0 z-20 rounded-[inherit] focus-visible:ring-4 focus-visible:ring-ring focus-visible:outline-none focus-visible:ring-inset"
          />
        )}
      </div>
      {failed && (
        <button
          type="button"
          onClick={() => {
            setFailed(false);
            setAttempt((a) => a + 1);
          }}
          aria-label={`Retry loading ${name} image`}
          className="tap-target absolute top-1/2 right-3 z-30 grid size-9 -translate-y-1/2 cursor-pointer place-items-center rounded-full border border-input bg-background/80 text-foreground transition-colors hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <RotateCw className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );
}
