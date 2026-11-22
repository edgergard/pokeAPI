import { useEffect, useRef, type KeyboardEvent } from 'react';
import { Check, Lock } from 'lucide-react';
import type { StageInfo, StageStatus } from '@/entities/ladder';
import { cn } from '@/shared/lib/cn';

type Props = {
  stages: readonly StageInfo[];
  statusOf: (stage: number) => StageStatus;
  selected: number;
  onSelect: (stage: number) => void;
  /** A locked node was activated: say why it is locked. */
  onLocked: (message: string) => void;
};

const STEP: Partial<Record<string, number>> = {
  ArrowUp: -1,
  ArrowLeft: -1,
  ArrowDown: 1,
  ArrowRight: 1,
};

export const lockedReason = (stage: number) => `Clear stage ${stage - 1} first`;

/**
 * The ladder's vertical node path (design.md component `LadderPath`): a list of real buttons —
 * cleared (✓), current (`aria-current="step"`, glowing), locked (`aria-disabled`, "Clear stage N
 * first"). One tab stop; arrow keys (and Home / End) move between nodes, and the selection follows
 * onto any node that isn't locked.
 */
export function LadderPath({ stages, statusOf, selected, onSelect, onLocked }: Props) {
  const listRef = useRef<HTMLOListElement>(null);
  const nodes = useRef<(HTMLButtonElement | null)[]>([]);

  // Start with the selected node in view inside the scrolling path (without scrolling the page).
  useEffect(() => {
    const list = listRef.current;
    const node = nodes.current[selected - 1];
    if (!list || !node) return;
    list.scrollTop = node.offsetTop - list.clientHeight / 2 + node.offsetHeight / 2;
    // Only on mount: later selections come from the player, who is already looking at the node.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const move = (from: number, to: number) => {
    const target = Math.min(Math.max(to, 1), stages.length);
    if (target === from) return;
    nodes.current[target - 1]?.focus();
    if (statusOf(target) !== 'locked') onSelect(target);
  };

  const onKeyDown = (stage: number) => (e: KeyboardEvent<HTMLButtonElement>) => {
    const step = STEP[e.key];
    if (step !== undefined) {
      e.preventDefault();
      move(stage, stage + step);
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      move(stage, e.key === 'Home' ? 1 : stages.length);
    }
  };

  return (
    <ol
      ref={listRef}
      aria-label="Stages"
      className="relative flex max-h-[24rem] flex-col gap-1 overflow-y-auto rounded-3xl border border-white/10 bg-card/60 p-2 lg:max-h-[min(70vh,44rem)]"
    >
      {stages.map((info) => {
        const status = statusOf(info.stage);
        const isSelected = info.stage === selected;
        const locked = status === 'locked';
        return (
          <li key={info.stage} className="relative">
            <button
              ref={(el) => {
                nodes.current[info.stage - 1] = el;
              }}
              type="button"
              tabIndex={isSelected ? 0 : -1}
              data-status={status}
              aria-current={status === 'current' ? 'step' : undefined}
              aria-disabled={locked ? 'true' : undefined}
              aria-pressed={locked ? undefined : isSelected}
              onClick={() => (locked ? onLocked(lockedReason(info.stage)) : onSelect(info.stage))}
              onKeyDown={onKeyDown(info.stage)}
              className={cn(
                'flex min-h-14 w-full items-center gap-3 rounded-2xl border px-2 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                locked ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-white/5',
                isSelected ? 'border-primary/60 bg-secondary' : 'border-transparent',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'grid size-10 shrink-0 place-items-center rounded-full border-2 font-mono text-sm font-bold',
                  status === 'cleared' &&
                    'border-rarity-uncommon bg-rarity-uncommon/15 text-rarity-uncommon',
                  status === 'current' &&
                    'border-primary bg-primary text-primary-foreground shadow-glow motion-safe:animate-pulse',
                  locked && 'border-border bg-muted text-muted-foreground',
                )}
              >
                {status === 'cleared' ? (
                  <Check className="size-5" />
                ) : locked ? (
                  <Lock className="size-4" />
                ) : (
                  info.stage
                )}
              </span>
              <span className="flex min-w-0 flex-col">
                <span
                  className={cn(
                    'text-sm font-semibold',
                    locked ? 'text-muted-foreground' : 'text-foreground',
                  )}
                >
                  Stage {info.stage}
                  <span className="font-normal text-muted-foreground"> · {info.rivalName}</span>
                </span>
                <span
                  className={cn(
                    'text-xs',
                    status === 'cleared' && 'text-rarity-uncommon',
                    status === 'current' && 'text-primary',
                    locked && 'text-muted-foreground',
                  )}
                >
                  {status === 'cleared'
                    ? 'Cleared'
                    : status === 'current'
                      ? 'Current'
                      : lockedReason(info.stage)}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}
