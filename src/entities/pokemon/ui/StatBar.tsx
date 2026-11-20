import type { AnimationEvent, CSSProperties } from 'react';
import { useCountUp } from '@/shared/lib/useCountUp';

/** Highest base stat in the games is 255 — used as the bar's full scale. */
const MAX_STAT = 255;

type Props = {
  label: string;
  value: number;
  /** Row position (0..3) — staggers the bar after the card's --bar-base. */
  index?: number;
};

export function StatBar({ label, value, index = 0 }: Props) {
  const pct = Math.min(100, Math.round((value / MAX_STAT) * 100));
  const { ref, display, start, finish } = useCountUp(value);

  // The digits share the bar's clock: they start when the (delayed, maybe paused) bar actually starts.
  const isBar = (e: AnimationEvent) => e.animationName === 'bar-grow';

  return (
    <div className="grid grid-cols-[2.75rem_2rem_1fr] items-center gap-2 text-[11px]">
      <dt className="font-semibold tracking-wider text-ink-400 uppercase">{label}</dt>
      <dd className="text-right font-mono font-bold text-ink-100 tabular-nums">
        <span className="sr-only">{value}</span>
        <span ref={ref} aria-hidden>
          {display}
        </span>
      </dd>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/8" aria-hidden>
        <div
          className="stat-fill h-full rounded-full bg-(--type)"
          style={
            {
              width: `${pct}%`,
              '--bar-delay': `calc(var(--bar-base, 200ms) + ${index * 60}ms)`,
            } as CSSProperties
          }
          onAnimationStart={(e) => isBar(e) && start()}
          onAnimationEnd={(e) => isBar(e) && finish()}
        />
      </div>
    </div>
  );
}
