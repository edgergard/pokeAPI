import type { CSSProperties } from 'react';
import { cn } from '@/shared/lib/cn';
import { formatDexNumber, formatName } from '@/shared/lib/format';
import { typeColor } from '../model/typeColors';
import type { Pokemon } from '../model/types';
import { TypeBadge } from './TypeBadge';

type Props = {
  pokemon: Pokemon;
  /** Position in the list — enables the staggered row entrance and badge glint. */
  index?: number;
};

/** Compact horizontal summary — used in the confirmation dialog. */
export function PokemonRow({ pokemon, index }: Props) {
  const { id, name, types, sprite, stats, totalStats } = pokemon;
  const staggered = index !== undefined;

  return (
    <li
      style={
        {
          '--type': typeColor(types[0]),
          ...(staggered && { '--i': index, '--glint-base': 'calc(300ms + var(--i) * 60ms)' }),
        } as CSSProperties
      }
      className={cn(
        staggered && 'row-in',
        'flex items-center gap-4 rounded-2xl border border-white/6 bg-[linear-gradient(90deg,color-mix(in_oklab,var(--type)_14%,transparent),transparent_60%)] p-3',
      )}
    >
      <div className="grid size-16 shrink-0 place-items-center rounded-xl bg-white/5">
        {sprite && <img src={sprite} alt="" className="size-16 [image-rendering:pixelated]" />}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex items-baseline gap-2">
          <span className="truncate font-display text-lg font-bold">{formatName(name)}</span>
          <span className="font-mono text-xs text-ink-500">{formatDexNumber(id)}</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {types.map((type, i) => (
            <TypeBadge key={type} type={type} index={staggered ? i : undefined} />
          ))}
        </div>
      </div>

      <dl className="hidden grid-cols-[repeat(3,2.25rem)] gap-x-2 text-right sm:grid">
        {(
          [
            ['HP', stats.hp],
            ['Atk', stats.attack],
            ['Spd', stats.speed],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <dt className="text-[10px] font-semibold tracking-wider text-ink-500 uppercase">{label}</dt>
            <dd className="font-mono text-sm font-bold">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="flex w-16 flex-col items-end border-l border-white/8 pl-4">
        <span className="text-[10px] font-semibold tracking-wider text-ink-500 uppercase">Total</span>
        <span className="font-mono text-lg font-bold text-(--type)">{totalStats}</span>
      </div>
    </li>
  );
}
