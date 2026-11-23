import { cn } from '@/shared/lib/cn';

/**
 * An XP bar (design.md Tokens: trainer = primary, Pokémon = rarity-rare, on a muted track). It
 * grows in once on mount; the motion setting stills it. The value is exposed as a progressbar.
 */
export function XpBar({
  value,
  max,
  label,
  tone,
}: {
  value: number;
  max: number;
  label: string;
  tone: 'trainer' | 'pokemon';
}) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 1;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      aria-valuetext={`${value} of ${max} XP`}
      className="h-2 w-full overflow-hidden rounded-full bg-muted"
    >
      <div
        className={cn(
          'h-full origin-left animate-[bar-grow_var(--dur-xl)_var(--ease-out-expo)_200ms_backwards] rounded-full',
          tone === 'trainer' ? 'bg-primary' : 'bg-rarity-rare',
        )}
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  );
}
