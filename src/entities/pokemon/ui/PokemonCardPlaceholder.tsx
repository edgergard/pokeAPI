import type { CSSProperties } from 'react';
import { cn } from '@/shared/lib/cn';
import { CapsuleGlyph } from '@/shared/ui/CapsuleGlyph';

type Props = {
  slot: number;
  variant: 'empty' | 'loading' | 'error';
  /** 'rise' — staggered page entrance; 'swap' — quick fade when a parent animates the slot; 'none' — a parent owns the reveal. */
  entrance?: 'rise' | 'swap' | 'none';
};

/** Same footprint as PokemonCard so the grid never jumps. */
export function PokemonCardPlaceholder({ slot, variant, entrance = 'rise' }: Props) {
  // An error replaces a loading slot in place, so it shakes instead of entering again.
  const motion =
    variant === 'error'
      ? 'slot-shake'
      : entrance === 'swap'
        ? 'swap-in'
        : entrance === 'rise'
          ? 'card-enter'
          : undefined;

  return (
    <div
      aria-busy={variant === 'loading'}
      style={
        {
          '--i': slot,
          animationDelay: motion === 'card-enter' ? `${slot * 60}ms` : undefined,
        } as CSSProperties
      }
      className={cn(
        motion,
        'relative flex min-h-[29rem] w-full flex-col items-center justify-center gap-4 overflow-hidden rounded-3xl border border-dashed p-6 text-center',
        variant === 'error' ? 'border-danger/40' : 'border-white/10',
        variant === 'loading' && 'shimmer border-solid',
      )}
    >
      <CapsuleGlyph
        className={cn(
          'size-16 text-white',
          variant === 'loading'
            ? 'ball-charge'
            : variant === 'empty'
              ? 'ball-breathe'
              : 'opacity-10',
        )}
      />
      <div className="flex flex-col gap-1">
        <span className="font-mono text-[10px] font-bold tracking-widest text-ink-500 uppercase">
          Slot {slot + 1}
        </span>
        <span className="text-sm text-ink-400">
          {variant === 'empty' && 'Waiting for a partner'}
          {variant === 'loading' && 'Summoning…'}
          {variant === 'error' && 'Couldn’t load this Pokémon'}
        </span>
      </div>
    </div>
  );
}
