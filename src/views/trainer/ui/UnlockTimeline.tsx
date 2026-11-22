import { useEffect, useId, useMemo, useRef } from 'react';
import { Check } from 'lucide-react';
import { nextUnlock, trainerTimeline } from '@/entities/progression';
import { cn } from '@/shared/lib/cn';
import { unlockLabel } from '../model/trainer';

/**
 * Every trainer level with what it unlocks (`trainerTimeline()`): reached levels are ticked, the next
 * level that unlocks a system carries `aria-current="step"`. A horizontal track that starts scrolled to
 * the trainer's level.
 */
export function UnlockTimeline({ level }: { level: number }) {
  const headingId = useId();
  const timeline = useMemo(() => trainerTimeline(), []);
  const upcoming = nextUnlock(level);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const track = trackRef.current;
    const item = track?.querySelector<HTMLElement>(`[data-level="${level}"]`);
    if (!track || !item) return;
    track.scrollLeft = Math.max(0, item.offsetLeft - 16);
  }, [level]);

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-3 rounded-3xl p-4 glass sm:p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={headingId} className="font-display text-xl font-bold tracking-tight">
          Unlocks
        </h2>
        <p className="text-sm text-muted-foreground">
          {upcoming
            ? `Next: Lv ${upcoming.level} · ${upcoming.unlocks.map(unlockLabel).join(' · ')}`
            : 'Every unlock reached'}
        </p>
      </div>
      <div
        ref={trackRef}
        role="group"
        aria-label="Trainer levels, scrollable"
        tabIndex={0}
        className="relative -mx-1 overflow-x-auto px-1 pb-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <ol className="flex w-max gap-2">
          {timeline.map((entry) => {
            const reached = entry.level <= level;
            const current = upcoming?.level === entry.level;
            return (
              <li
                key={entry.level}
                data-level={entry.level}
                data-reached={reached || undefined}
                aria-current={current ? 'step' : undefined}
                className={cn(
                  'flex w-40 shrink-0 flex-col gap-1.5 rounded-2xl border p-3',
                  current
                    ? 'border-primary bg-primary/10'
                    : reached
                      ? 'border-border bg-muted/60'
                      : 'border-dashed border-border bg-card/40',
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      'font-mono text-sm font-bold',
                      reached || current ? 'text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    Lv {entry.level}
                  </span>
                  {reached && (
                    <span className="inline-flex items-center gap-1 text-xs text-rarity-uncommon">
                      <Check aria-hidden className="size-3.5" />
                      Reached
                    </span>
                  )}
                  {current && <span className="text-xs font-semibold text-primary">Next</span>}
                </span>
                <ul className="flex flex-col gap-0.5 text-xs text-foreground">
                  {entry.unlocks.map((unlock) => (
                    <li key={unlockLabel(unlock)}>{unlockLabel(unlock)}</li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
