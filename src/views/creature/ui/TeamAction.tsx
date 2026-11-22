import { useId } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import type { TeamStatus } from '../model/creature';

export const TEAM_FULL_TEXT = 'Team is full. Edit your team on the Ladder to swap.';

/**
 * Primary "Add to team" / "In team ✓". One button element across the states, so focus stays put when it
 * flips to "In team ✓". A full team keeps it focusable but `aria-disabled`, with the reason and a Ladder link.
 */
export function TeamAction({ status, onAdd }: { status: TeamStatus; onAdd: () => void }) {
  const reasonId = useId();
  const inTeam = status.kind === 'inTeam';
  const full = status.kind === 'full';

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <button
        type="button"
        onClick={() => {
          if (status.kind === 'canAdd') onAdd();
        }}
        aria-disabled={status.kind !== 'canAdd' || undefined}
        aria-describedby={full ? reasonId : undefined}
        className={cn(
          'inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl px-5 text-base font-semibold transition-colors',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          status.kind === 'canAdd' &&
            'cursor-pointer bg-primary text-primary-foreground shadow-glow hover:bg-primary-hover',
          inTeam &&
            'cursor-default border border-rarity-uncommon bg-rarity-uncommon/10 text-rarity-uncommon',
          full && 'cursor-not-allowed border border-border bg-secondary text-muted-foreground',
        )}
      >
        {inTeam ? (
          'In team ✓'
        ) : (
          <>
            <Plus aria-hidden className="size-4" /> Add to team
          </>
        )}
      </button>
      {full && (
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground sm:justify-end">
          <span id={reasonId}>{TEAM_FULL_TEXT}</span>
          <Link
            href="/ladder/"
            className="tap-target font-semibold text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Open Ladder
          </Link>
        </p>
      )}
    </div>
  );
}
