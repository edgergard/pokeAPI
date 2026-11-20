import type { CSSProperties } from 'react';
import { cn } from '@/shared/lib/cn';
import { formatDexNumber, formatName } from '@/shared/lib/format';
import { usePointerTilt } from '@/shared/lib/usePointerTilt';
import { typeColor } from '../model/typeColors';
import type { Pokemon } from '../model/types';
import { StatBar } from './StatBar';
import { TypeBadge } from './TypeBadge';

type Props = {
  pokemon: Pokemon;
  slot: number;
  /**
   * 'rise' — staggered page entrance; 'swap' — quick fade when a parent animates the slot;
   * 'none' — a parent owns the reveal (the card's inner cascade still plays).
   */
  entrance?: 'rise' | 'swap' | 'none';
};

export function PokemonCard({ pokemon, slot, entrance = 'rise' }: Props) {
  const { id, name, types, artwork, stats, baseExperience, height, weight } = pokemon;
  const color = typeColor(types[0]);
  const tiltRef = usePointerTilt<HTMLElement>();

  // One timeline per card: rise → stat bars + count-up → badge glint → idle float.
  const timeline = {
    '--type': color,
    '--bar-base': `${slot * 60 + 350}ms`,
    '--glint-base': `${slot * 60 + 1300}ms`,
    '--float-dur': `${2200 + slot * 200}ms`,
    '--float-delay': `${slot * 60 + 600}ms`,
    animationDelay: entrance === 'rise' ? `${slot * 60}ms` : undefined,
  } as CSSProperties;

  return (
    <article
      ref={tiltRef}
      style={timeline}
      className={cn(
        entrance === 'swap' ? 'swap-in' : entrance === 'rise' && 'card-enter',
        'card-tilt group relative flex w-full flex-col overflow-hidden rounded-3xl border border-white/8 bg-ink-900 hover:-translate-y-1',
      )}
    >
      {/* Artwork stage */}
      <div className="relative aspect-[5/4] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(120%_90%_at_50%_100%,var(--type)_0%,transparent_65%)] opacity-35" />
        <div className="dot-grid absolute inset-0 opacity-40" />

        <span className="absolute top-4 left-4 font-mono text-xs font-bold text-white/70">
          {formatDexNumber(id)}
        </span>
        <span className="absolute top-4 right-4 font-mono text-[10px] font-bold tracking-widest text-white/70 uppercase">
          Slot {slot + 1}
        </span>

        <div
          aria-hidden
          className="art-shadow absolute bottom-[7%] left-1/2 h-4 w-[45%] -translate-x-1/2 rounded-[50%] bg-black/50 blur-md"
        />
        <div className="art-float absolute inset-0">
          {artwork ? (
            <img
              src={artwork}
              alt={formatName(name)}
              loading="lazy"
              className="absolute inset-0 m-auto h-[88%] object-contain drop-shadow-[0_18px_24px_rgb(0_0_0/0.45)] transition-transform duration-500 group-hover:scale-[1.06] group-hover:-rotate-2"
            />
          ) : (
            <div className="absolute inset-0 grid place-items-center font-display text-6xl text-white/20">?</div>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="flex flex-1 flex-col gap-4 border-t border-white/6 p-5">
        <div className="flex flex-col gap-2">
          <h3 className="font-display text-2xl leading-none font-bold tracking-tight text-white">
            {formatName(name)}
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {types.map((type, i) => (
              <TypeBadge key={type} type={type} index={i} />
            ))}
          </div>
        </div>

        <dl className="flex flex-col gap-1.5">
          <StatBar label="HP" value={stats.hp} index={0} />
          <StatBar label="Atk" value={stats.attack} index={1} />
          <StatBar label="Def" value={stats.defense} index={2} />
          <StatBar label="Spd" value={stats.speed} index={3} />
        </dl>

        <dl className="mt-auto grid grid-cols-3 gap-2 rounded-2xl bg-white/[0.035] p-3 text-center">
          <Meta label="Exp" value={baseExperience ?? '—'} />
          <Meta label="Height" value={`${height} m`} />
          <Meta label="Weight" value={`${weight} kg`} />
        </dl>
      </div>

      {/* Pointer-tracked glare + type-tinted foil; visible only while tilting. */}
      <div aria-hidden className="holo pointer-events-none absolute inset-0 z-10" />
    </article>
  );
}

function Meta({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[10px] font-semibold tracking-wider text-ink-500 uppercase">{label}</dt>
      <dd className="font-mono text-[13px] font-bold text-ink-100">{value}</dd>
    </div>
  );
}
