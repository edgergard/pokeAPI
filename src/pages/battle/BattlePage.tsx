import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { BattleSetup, type Picks } from '@/features/battle-setup';
import { MotionToggle } from '@/features/motion-toggle/MotionToggle';
import type { BattleTeam } from '@/entities/battle';
import { href } from '@/shared/lib/router';
import { Spinner } from '@/shared/ui/Spinner';

// The arena (and, inside it, three.js) loads only once a battle starts.
const BattleArena = lazy(() => import('@/widgets/battle-arena').then((m) => ({ default: m.BattleArena })));

type State =
  | { phase: 'setup' }
  | { phase: 'battle'; red: BattleTeam; blue: BattleTeam; seed: number };

/** Setup, then the arena. "New battle" returns to setup with the previous picks kept. */
export default function BattlePage() {
  const [state, setState] = useState<State>({ phase: 'setup' });
  const [picks, setPicks] = useState<Picks>({ red: null, blue: null });
  const headingRef = useRef<HTMLHeadingElement>(null);
  const backFromBattle = useRef(false);

  // "New battle" unmounts the arena (and the control that held focus): land on the page heading,
  // right above the setup, instead of <body>.
  useEffect(() => {
    if (state.phase !== 'setup' || !backFromBattle.current) return;
    backFromBattle.current = false;
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView({ block: 'nearest' });
  }, [state.phase]);

  return (
    <main className="relative mx-auto flex min-h-dvh max-w-5xl flex-col gap-6 px-4 py-8 sm:py-12">
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <a
            href={href('/')}
            className="-ml-3 w-fit rounded-lg px-3 py-2 text-sm text-ink-300 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-accent"
          >
            ← Back to Trainer Studio
          </a>
          <MotionToggle />
        </div>
        <h1 ref={headingRef} tabIndex={-1} className="font-display text-3xl font-extrabold tracking-tight focus:outline-none sm:text-4xl">
          Battle arena
        </h1>
      </header>

      {state.phase === 'setup' ? (
        <BattleSetup
          picks={picks}
          onPicksChange={setPicks}
          onReady={(red, blue) => setState({ phase: 'battle', red, blue, seed: Math.floor(Math.random() * 2 ** 31) })}
        />
      ) : (
        <section aria-label="Battle">
          <Suspense
            fallback={
              <div className="grid aspect-[4/5] place-items-center rounded-3xl border border-white/10 bg-ink-950 min-[480px]:aspect-[4/3] md:aspect-video">
                <Spinner className="size-7" label="Loading the arena" />
              </div>
            }
          >
            <BattleArena
              key={state.seed}
              red={state.red}
              blue={state.blue}
              seed={state.seed}
              onNewBattle={() => {
                backFromBattle.current = true;
                setState({ phase: 'setup' });
              }}
            />
          </Suspense>
        </section>
      )}
    </main>
  );
}
