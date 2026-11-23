import type { CSSProperties } from 'react';
import { Star } from 'lucide-react';
import {
  RARITY_BG_CLASS,
  RARITY_FRAME,
  RARITY_LABEL,
  RARITY_TEXT_CLASS,
  rarityColor,
  type RevealResult,
} from '@/entities/capsule';
import { getSpecies, typeColor, type PokemonType } from '@/entities/pokemon';
import { economy } from '@/shared/config/economy';
import { cn } from '@/shared/lib/cn';
import { formatName } from '@/shared/lib/format';
import { usePointerTilt } from '@/shared/lib/usePointerTilt';
import { outcomeLabel, speciesName } from '../model/reveal';
import { CreatureArt } from './CreatureArt';

/** Filled / empty stars with a text equivalent. */
export function StarRow({ stars, className }: { stars: number; className?: string }) {
  const max = economy.pokemon.maxStars;
  return (
    <span className={cn('inline-flex items-center gap-0.5', className)}>
      <span className="sr-only">
        {stars} of {max} stars
      </span>
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          aria-hidden
          className={cn('size-3.5', i < stars ? 'fill-primary text-primary' : 'text-border')}
        />
      ))}
    </span>
  );
}

function TypePill({ type }: { type: PokemonType }) {
  return (
    <span
      className="inline-flex h-6 items-center gap-1.5 rounded-full border border-(--pill)/40 bg-(--pill)/12 px-2.5 text-xs font-semibold text-foreground"
      style={{ '--pill': typeColor(type) } as CSSProperties}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-(--pill)" />
      {formatName(type)}
    </span>
  );
}

/** Outcome badge: New! / ★ up / +N dust / Dupe 1/2 — on the rarity colour, with dark text (AA). */
export function OutcomeBadge({ result, big }: { result: RevealResult; big?: boolean }) {
  const label = result.outcome === 'new' && big ? 'New!' : outcomeLabel(result);
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center rounded-full px-2.5 text-xs font-semibold text-background',
        RARITY_BG_CLASS[result.rarity],
      )}
    >
      {label}
    </span>
  );
}

/** Rarity as text plus colour (never colour alone). */
export function RarityTag({ result, className }: { result: RevealResult; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-mono text-xs font-bold tracking-[0.12em] uppercase',
        RARITY_TEXT_CLASS[result.rarity],
        className,
      )}
    >
      <Star aria-hidden className="size-3.5" />
      {RARITY_LABEL[result.rarity]}
    </span>
  );
}

/** The large holo card a capsule flips into. */
export function RevealCard({ result, className }: { result: RevealResult; className?: string }) {
  const species = getSpecies(result.speciesId);
  const name = speciesName(result.speciesId);
  const color = typeColor(species?.types[0]);
  const rc = rarityColor(result.rarity);
  const tiltRef = usePointerTilt<HTMLElement>();

  return (
    <article
      ref={tiltRef}
      data-rarity={result.rarity}
      aria-label={`${RARITY_LABEL[result.rarity]}: ${name}, ${outcomeLabel(result)}, level ${result.level}, ${result.stars} stars`}
      style={
        {
          '--type': color,
          borderColor: rc,
          boxShadow: `0 0 0 4px color-mix(in oklab, ${rc} 18%, transparent), 0 20px 60px -20px ${rc}`,
        } as CSSProperties
      }
      className={cn(
        'card-tilt relative isolate flex w-full flex-col gap-2.5 overflow-hidden rounded-3xl bg-linear-160 from-card to-muted p-3.5',
        RARITY_FRAME[result.rarity],
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <OutcomeBadge result={result} big />
        <span className="font-mono text-xs text-muted-foreground">Lv {result.level}</span>
      </div>
      <div
        className="relative h-44 overflow-hidden rounded-2xl bg-secondary sm:h-48"
        style={{
          background: `radial-gradient(circle at 50% 40%, color-mix(in oklab, ${color} 50%, transparent), color-mix(in oklab, ${color} 5%, transparent) 70%), var(--secondary)`,
        }}
      >
        <div aria-hidden className="absolute inset-0 dot-grid opacity-40" />
        <CreatureArt
          speciesId={result.speciesId}
          name={name}
          color={color}
          className="absolute inset-0 m-auto h-[88%] w-full drop-shadow-[0_18px_24px_rgb(0_0_0/0.45)]"
        />
      </div>
      <p className="font-display text-2xl leading-tight font-extrabold tracking-tight text-card-foreground">
        {name}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {species?.types.map((t) => (
            <TypePill key={t} type={t} />
          ))}
        </div>
        <RarityTag result={result} />
      </div>
      <StarRow stars={result.stars} />
      {/* Pointer-tracked glare + type-tinted foil; visible only while tilting (global .holo styles). */}
      <div aria-hidden className="holo pointer-events-none absolute inset-0 z-10" />
    </article>
  );
}

/** One tile of the multi-open summary grid. */
export function MiniCard({ result }: { result: RevealResult }) {
  const species = getSpecies(result.speciesId);
  const name = speciesName(result.speciesId);
  const color = typeColor(species?.types[0]);
  return (
    <div
      data-rarity={result.rarity}
      className={cn(
        'flex h-full flex-col items-center gap-1.5 rounded-2xl bg-card p-2.5 text-center',
        RARITY_FRAME[result.rarity],
      )}
      style={{ borderColor: rarityColor(result.rarity) }}
    >
      <div
        className="relative aspect-square w-full max-w-24 rounded-xl"
        style={{
          background: `radial-gradient(circle at 50% 45%, color-mix(in oklab, ${color} 40%, transparent), transparent 70%)`,
        }}
      >
        <CreatureArt
          speciesId={result.speciesId}
          name={name}
          color={color}
          className="absolute inset-0 m-auto size-full"
        />
      </div>
      <span className="w-full truncate text-sm font-semibold text-card-foreground">{name}</span>
      <RarityTag result={result} className="tracking-wider" />
      <OutcomeBadge result={result} />
    </div>
  );
}
