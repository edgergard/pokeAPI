import Link from 'next/link';
import { Check, Clock, Lock } from 'lucide-react';
import type { QuestBoard, QuestRow } from '@/entities/quest';
import { cn } from '@/shared/lib/cn';
import { hoursUntil, questLabel, refillTime, rewardParts } from '../model/copy';

type Props = {
  /** `questBoard(save, now)` — computed with a fresh `Date.now()`. */
  board: QuestBoard;
  /** The same `now` the board was computed with (for "New quests in 5 h"). */
  now: number;
  /** Claim a finished quest (pool id + quest day). */
  onClaim: (id: string, day: string) => void;
  /** Tighter rows (battle result). */
  compact?: boolean;
  /** Where an unfinished quest's title links to (e.g. `/ladder/`); plain text when omitted. */
  playHref?: string;
  className?: string;
};

/**
 * Daily quests (design.md component `QuestList`): locked, open rows with progress and Claim,
 * all claimed, and the clock guard. Presentational: the caller refreshes, computes and claims.
 */
export function QuestList({ board, now, onClaim, compact = false, playHref, className }: Props) {
  if (board.state === 'locked') {
    return (
      <p
        data-quest-state="locked"
        className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}
      >
        <Lock aria-hidden className="size-4 shrink-0" />
        Daily quests unlock at Trainer Lv {board.unlockLevel}
      </p>
    );
  }

  const refill = board.clockBehind
    ? `Quests refill at ${refillTime(board.refreshHour)}`
    : `New quests in ${hoursUntil(board.nextRefreshAt, now)} h`;

  if (board.state === 'allClaimed') {
    return (
      <p
        data-quest-state="allClaimed"
        className={cn('flex items-center gap-2 text-sm text-muted-foreground', className)}
      >
        <Clock aria-hidden className="size-4 shrink-0" />
        No quests right now. {refill}
      </p>
    );
  }

  return (
    <div data-quest-state="open" className={cn('flex flex-col gap-3', className)}>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Clock aria-hidden className="size-3.5 shrink-0" />
        {refill}
      </p>
      <ul className={cn('flex flex-col', compact ? 'gap-2' : 'gap-3')}>
        {board.rows.map((row) => (
          <QuestItem
            key={`${row.day}:${row.id}`}
            row={row}
            carriedOver={!compact && row.day !== board.today}
            compact={compact}
            playHref={playHref}
            onClaim={onClaim}
          />
        ))}
      </ul>
    </div>
  );
}

function QuestItem({
  row,
  carriedOver,
  compact,
  playHref,
  onClaim,
}: {
  row: QuestRow;
  carriedOver: boolean;
  compact: boolean;
  playHref: string | undefined;
  onClaim: (id: string, day: string) => void;
}) {
  const label = questLabel(row.kind, row.target);
  const reward = rewardParts(row.reward).join(' · ');
  const progress = Math.min(Math.floor(row.progress), row.target);
  const percent = row.target > 0 ? (progress / row.target) * 100 : 0;

  return (
    <li
      data-quest={row.id}
      data-claimed={row.claimed || undefined}
      className={cn(
        'flex items-center gap-3 rounded-2xl bg-muted',
        compact ? 'px-3 py-2' : 'px-4 py-3',
        row.claimed && 'opacity-80',
      )}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <span className="text-sm font-semibold text-foreground">
            {playHref && !row.finished ? (
              <Link
                href={playHref}
                className="rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {label}
              </Link>
            ) : (
              label
            )}
            {carriedOver && (
              <span className="ml-2 text-xs font-normal text-muted-foreground">Carried over</span>
            )}
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {reward && <span className="mr-2">{reward}</span>}
            <span className="text-foreground">
              {progress} / {row.target}
            </span>
          </span>
        </div>
        <div
          role="progressbar"
          aria-label={label}
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={row.target}
          className="h-1.5 overflow-hidden rounded-full bg-background"
        >
          <div
            className={cn(
              'h-full rounded-full',
              row.finished ? 'bg-rarity-uncommon' : 'bg-primary',
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
      {row.claimed ? (
        <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-rarity-uncommon">
          <Check aria-hidden className="size-4" />
          Claimed
        </span>
      ) : row.claimable ? (
        <button
          type="button"
          onClick={() => onClaim(row.id, row.day)}
          aria-label={`Claim ${label}${reward ? `: ${reward}` : ''}`}
          className="tap-target h-9 shrink-0 cursor-pointer rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Claim
        </button>
      ) : null}
    </li>
  );
}
