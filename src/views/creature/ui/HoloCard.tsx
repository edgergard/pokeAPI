import type { CSSProperties } from 'react';
import { Star } from 'lucide-react';
import { RARITY_FRAME, RARITY_LABEL, RARITY_TEXT_CLASS, rarityColor } from '@/entities/capsule';
import { typeColor, type PokemonType, type Species } from '@/entities/pokemon';
import type { OwnedPokemon } from '@/entities/save';
import { economy } from '@/shared/config/economy';
import { cn } from '@/shared/lib/cn';
import { formatName } from '@/shared/lib/format';
import { usePointerTilt } from '@/shared/lib/usePointerTilt';
import { CreatureArt } from '@/widgets/capsule-reveal';

/** Filled / empty stars with a text equivalent ("2 of 5 stars"). */
export function StarRow({ stars, className }: { stars: number; className?: string }) {
  const max = economy.pokemon.maxStars;
  return (
    <span
      role="img"
      aria-label={`${stars} of ${max} stars`}
      className={cn('inline-flex gap-0.5', className)}
    >
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          aria-hidden
          className={cn('size-4', i < stars ? 'fill-primary text-primary' : 'text-border')}
        />
      ))}
    </span>
  );
}

/** Type label at text-xs (the shared TypeBadge is smaller than the design allows). */
export function TypePill({ type }: { type: PokemonType }) {
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

/**
 * The large holo card (design.md component `HoloCard`, variant large / silhouette): pointer tilt with a
 * type-tinted foil (inert on touch and reduced motion), rarity frame shape + label, Lv and stars.
 */
export function HoloCard({
  species,
  owned,
}: {
  species: Species;
  owned: OwnedPokemon | undefined;
}) {
  const tiltRef = usePointerTilt<HTMLElement>();
  const color = typeColor(species.types[0]);
  const rc = rarityColor(species.rarity);
  const rarity = RARITY_LABEL[species.rarity];
  const types = species.types.map(formatName).join(' and ');
  const label = owned
    ? `${species.name}, ${types}, ${rarity}, level ${owned.level}, ${owned.stars} of ${economy.pokemon.maxStars} stars`
    : `${species.name}, ${types}, ${rarity}, not in your collection`;

  return (
    <article
      ref={tiltRef}
      aria-label={label}
      data-rarity={species.rarity}
      data-owned={owned ? 'true' : 'false'}
      style={
        {
          '--type': color,
          borderColor: owned ? rc : undefined,
          boxShadow: owned
            ? `0 0 0 4px color-mix(in oklab, ${rc} 14%, transparent), 0 30px 70px -28px ${rc}`
            : undefined,
        } as CSSProperties
      }
      className={cn(
        'card-tilt relative isolate flex w-full flex-col gap-3 overflow-hidden rounded-3xl bg-linear-160 from-card to-muted p-4',
        owned ? RARITY_FRAME[species.rarity] : 'border-2 border-dashed border-border',
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'inline-flex items-center gap-1 font-mono text-xs font-bold tracking-[0.12em] uppercase',
            RARITY_TEXT_CLASS[species.rarity],
          )}
        >
          <Star aria-hidden className="size-3.5" />
          {rarity}
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          {owned ? `Lv ${owned.level}` : 'Not owned'}
        </span>
      </div>
      <div
        className="relative h-64 overflow-hidden rounded-2xl sm:h-72"
        style={{
          background: `radial-gradient(circle at 50% 42%, color-mix(in oklab, ${color} ${owned ? 50 : 30}%, transparent), color-mix(in oklab, ${color} 5%, transparent) 70%), var(--secondary)`,
        }}
      >
        <div aria-hidden className="absolute inset-0 dot-grid opacity-40" />
        <CreatureArt
          speciesId={species.id}
          name={species.name}
          color={color}
          className={cn(
            'absolute inset-0 m-auto h-[88%] w-full',
            owned ? 'drop-shadow-[0_18px_24px_rgb(0_0_0/0.45)]' : 'opacity-80 brightness-0',
          )}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-display text-2xl leading-tight font-extrabold tracking-tight text-card-foreground">
          {species.name}
        </p>
        {owned && <StarRow stars={owned.stars} />}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {species.types.map((type) => (
          <TypePill key={type} type={type} />
        ))}
      </div>
      {/* Pointer-tracked glare + type-tinted foil; visible only while tilting (global .holo styles). */}
      <div aria-hidden className="holo pointer-events-none absolute inset-0 z-10" />
    </article>
  );
}
