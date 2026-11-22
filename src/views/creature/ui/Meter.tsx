import { cn } from '@/shared/lib/cn';

/** A labelled progress bar (`role="progressbar"` with its values, a text equivalent beside it). */
export function Meter({
  label,
  value,
  max,
  valueText,
  fillClass = 'bg-rarity-rare',
  className,
}: {
  label: string;
  value: number;
  max: number;
  valueText?: string;
  fillClass?: string;
  className?: string;
}) {
  const ratio = max > 0 ? Math.min(1, Math.max(0, value / max)) : 1;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={valueText}
      className={cn('h-2 w-full overflow-hidden rounded-full bg-muted', className)}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-500', fillClass)}
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  );
}
