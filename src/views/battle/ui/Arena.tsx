import { lazy, Suspense, type ComponentProps } from 'react';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { Spinner } from '@/shared/ui/Spinner';

// The arena (and, inside it, three.js) loads only once a battle starts.
const loadArena = () => import('@/widgets/battle-arena');
const BattleArena = lazy(() => loadArena().then((m) => ({ default: m.BattleArena })));

/** Starts fetching the arena chunk early (e.g. on the preview), so Fight shows it sooner. */
export function preloadArena(): void {
  void loadArena().catch(() => {
    // The lazy component retries and its ErrorBoundary reports a real failure.
  });
}

type ArenaProps = ComponentProps<typeof BattleArena>;

/** The lazy battle arena behind an error boundary, with a same-size "Preparing arena" fallback. */
export function Arena(props: ArenaProps) {
  return (
    <ErrorBoundary key={props.seed} title="The battle arena couldn’t load">
      <Suspense
        fallback={
          <div className="grid aspect-[4/5] place-items-center rounded-3xl border border-white/10 bg-background min-[480px]:aspect-[4/3] md:aspect-video">
            <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
              <Spinner className="size-7" label="Preparing arena" />
              Preparing arena
            </div>
          </div>
        }
      >
        <BattleArena {...props} />
      </Suspense>
    </ErrorBoundary>
  );
}
