'use client';

import { useEffect, useRef, type CSSProperties } from 'react';
import Link from 'next/link';
import { Star } from 'lucide-react';
import type { TrainerBattleResult } from '@/entities/progression';
import { usePrefersReducedMotion } from '@/shared/lib/motion';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import { primaryAction, unlockLines } from '../model/unlocks';

type Props = {
  /** The battle summary's trainer part (`summary.trainer`): new level and what it unlocked. */
  result: Pick<TrainerBattleResult, 'toLevel' | 'unlocks'>;
  open: boolean;
  onClose: () => void;
  /** "Fill slot N": the caller opens the team dialog with slot N pulsing. */
  onFillSlot: (slot: number) => void;
};

const SPARKS = 12;
const SPARK_COLORS = [
  'var(--color-primary)',
  'var(--color-rarity-legendary)',
  'var(--color-rarity-epic)',
  'var(--color-foreground)',
];

const linkClass =
  'inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-glow transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring max-sm:h-11';

/**
 * Trainer level-up (design.md `level-up`): the new level with a one-shot burst, what it unlocked and
 * one contextual next step (Fill slot N / See quests / Learn talent), focused on open. "Later" closes.
 */
export function LevelUpDialog({ result, open, onClose, onFillSlot }: Props) {
  const lines = unlockLines(result.unlocks);
  const action = primaryAction(result.unlocks);
  const primaryRef = useRef<HTMLElement | null>(null);
  const setPrimary = (el: HTMLElement | null) => {
    primaryRef.current = el;
  };

  // After Dialog's own effect (children run first) has called showModal(): focus the primary.
  useEffect(() => {
    if (open) primaryRef.current?.focus();
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Trainer Lv ${result.toLevel}`}
      className="w-[min(440px,calc(100vw-2rem))]"
      footer={
        <>
          <Button variant="outline" onClick={onClose} className="cursor-pointer justify-center">
            Later
          </Button>
          {action.kind === 'fillSlot' ? (
            <Button
              ref={setPrimary}
              onClick={() => onFillSlot(action.slot)}
              className="cursor-pointer justify-center"
            >
              {action.label}
            </Button>
          ) : (
            <Link ref={setPrimary} href={action.href} onClick={onClose} className={linkClass}>
              {action.label}
            </Link>
          )}
        </>
      }
    >
      <div className="flex flex-col items-center gap-5 text-center">
        <LevelBadge level={result.toLevel} />
        {lines.length > 0 ? (
          <ul aria-label="Unlocked" className="flex flex-wrap justify-center gap-2">
            {lines.map((line) => (
              <li
                key={line}
                className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-sm font-semibold text-foreground"
              >
                {line}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm font-semibold text-foreground">+1 talent point</p>
        )}
      </div>
    </Dialog>
  );
}

/** "Lv 3" medallion with a one-shot ring and spark burst (none under reduced motion). */
function LevelBadge({ level }: { level: number }) {
  const reduced = usePrefersReducedMotion();
  return (
    <div className="relative grid size-28 place-items-center">
      {!reduced && (
        <div aria-hidden data-testid="level-up-burst" className="absolute top-1/2 left-1/2">
          <span className="absolute -top-20 -left-20 size-40 animate-[burst-ring_var(--dur-xl)_var(--ease-out-expo)_150ms] rounded-full border-2 border-primary/60 opacity-0" />
          {Array.from({ length: SPARKS }, (_, i) => {
            const angle = (i / SPARKS) * Math.PI * 2;
            const distance = 70 + ((i * 29) % 40);
            const style = {
              '--dx': `${(Math.cos(angle) * distance).toFixed(1)}px`,
              '--dy': `${(Math.sin(angle) * distance).toFixed(1)}px`,
              '--rot': `${((i * 97) % 360) - 180}deg`,
              background: SPARK_COLORS[i % SPARK_COLORS.length],
            } as CSSProperties;
            return (
              <span
                key={i}
                style={style}
                className="absolute -top-1 -left-1 size-2 animate-[spark_var(--dur-2xl)_var(--ease-out-expo)_150ms] rounded-sm opacity-0"
              />
            );
          })}
        </div>
      )}
      <div className="relative grid size-24 place-items-center rounded-full border-2 border-primary bg-card shadow-glow">
        <Star className="absolute -top-3 size-6 fill-primary text-primary" aria-hidden />
        <span className="font-mono text-xs text-muted-foreground">Trainer</span>
        <span className="-mt-3 font-display text-3xl font-extrabold">Lv {level}</span>
      </div>
    </div>
  );
}
