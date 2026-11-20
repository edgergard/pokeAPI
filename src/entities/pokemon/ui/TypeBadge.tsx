import type { CSSProperties } from 'react';
import { formatName } from '@/shared/lib/format';
import { cn } from '@/shared/lib/cn';
import { typeColor } from '../model/typeColors';
import type { PokemonType } from '../model/types';

type Props = {
  type: PokemonType;
  className?: string;
  /** Position among sibling badges — enables the one-shot glint, staggered by index. */
  index?: number;
};

export function TypeBadge({ type, className, index }: Props) {
  const glint = index !== undefined;

  return (
    <span
      style={{ '--type': typeColor(type), ...(glint && { '--glint-i': index }) } as CSSProperties}
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-semibold tracking-wide uppercase',
        'border-(--type)/35 bg-(--type)/12 text-(--type)',
        glint && 'glint relative overflow-hidden',
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-(--type)" />
      {formatName(type)}
    </span>
  );
}
