'use client';

import { lazy, Suspense, useEffect, useRef, useState, type ComponentProps } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { BattleSetup, type Picks } from '@/features/battle-setup';
import { MotionToggle } from '@/features/motion-toggle/MotionToggle';
import type { BattleTeam } from '@/entities/battle';
import { href } from '@/shared/lib/router';
import { useHydrated } from '@/shared/lib/useHydrated';
import { ErrorBoundary } from '@/shared/ui/ErrorBoundary';
import { Spinner } from '@/shared/ui/Spinner';
import { BattleAmbient } from './BattleAmbient';

// The arena (and, inside it, three.js) loads only once a battle starts.
const BattleArena = lazy(() => import('@/widgets/battle-arena').then((m) => ({ default: m.BattleArena })));

type State =
  | { phase: 'setup' }
  | { phase: 'battle'; red: BattleTeam; blue: BattleTeam; seed: number };

/** Setup, then the arena. "New battle" returns to setup with the previous picks kept. */
export default function BattlePage() {
  const [state, setState] = useState<State>({ phase: 'setup' });
  const [picks, setPicks] = useState<Picks>({ red: null, blue: null });
  /**
   * The picks depend on the roster (localStorage) and `?red=`, neither of which exists in the prerendered HTML:
   * until hydration a same-size placeholder stands in, so no wrong trainers flash and swap.
   */
  const hydrated = useHydrated();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const backFromBattle = useRef(false);
  const battleRef = useRef<HTMLElement>(null);

  // "New battle" unmounts the arena (and the control that held focus): land on the page heading,
  // right above the setup, instead of <body>.
  useEffect(() => {
    if (state.phase !== 'setup' || !backFromBattle.current) return;
    backFromBattle.current = false;
    headingRef.current?.focus({ preventScroll: true });
    headingRef.current?.scrollIntoView({ block: 'nearest' });
  }, [state.phase]);

  // Fight unmounts the setup (and the button that held focus): move focus to the battle region,
  // so keyboard users continue from the arena controls instead of the top of <body>.
  useEffect(() => {
    if (state.phase === 'battle') battleRef.current?.focus({ preventScroll: true });
  }, [state.phase]);

  return (
    <main className="relative isolate mx-auto flex min-h-dvh max-w-5xl flex-col gap-6 px-4 py-8 sm:py-12">
      <BattleAmbient paused={state.phase === 'battle'} />
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <Link
            href={href('/')}
            className="tap-target -ml-3 w-fit rounded-lg px-3 py-2 text-sm text-ink-300 transition-colors hover:bg-white/5 hover:text-white focus-visible:outline-2 focus-visible:outline-accent"
          >
            ← Back to Trainer Studio
          </Link>
          <MotionToggle />
        </div>
        <h1 ref={headingRef} tabIndex={-1} className="font-display text-3xl font-extrabold tracking-tight focus:outline-none sm:text-4xl">
          Battle arena
        </h1>
      </header>

      {state.phase === 'setup' ? (
        hydrated ? (
          <SetupWithQuery
            picks={picks}
            onPicksChange={setPicks}
            onReady={(red, blue) => setState({ phase: 'battle', red, blue, seed: Math.floor(Math.random() * 2 ** 31) })}
          />
        ) : (
          <SetupPlaceholder />
        )
      ) : (
        <section ref={battleRef} tabIndex={-1} aria-label="Battle" className="focus:outline-none">
          <ErrorBoundary key={state.seed} title="The battle arena couldn’t load">
            <Suspense
              fallback={
                <div className="grid aspect-[4/5] place-items-center rounded-3xl border border-white/10 bg-ink-950 min-[480px]:aspect-[4/3] md:aspect-video">
                  <Spinner className="size-7" label="Loading the arena" />
                </div>
              }
            >
              <BattleArena
                red={state.red}
                blue={state.blue}
                seed={state.seed}
                onNewBattle={() => {
                  backFromBattle.current = true;
                  setState({ phase: 'setup' });
                }}
              />
            </Suspense>
          </ErrorBoundary>
        </section>
      )}
    </main>
  );
}

type SetupProps = Omit<ComponentProps<typeof BattleSetup>, 'preferredRedId'>;

/**
 * Reads `?red=<trainer id>` ("Battle with this team" on home): that team starts in Red.
 * Rendered only after hydration, so useSearchParams never runs during prerender (where it would turn the
 * whole page into a client-rendered shell) and has the new URL on client-side navigation.
 */
function SetupWithQuery(props: SetupProps) {
  return <BattleSetup {...props} preferredRedId={useSearchParams().get('red')} />;
}

/** Same footprint as the two corners + Fight button, so hydration doesn't shift the page. */
function SetupPlaceholder() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading teams">
      <div className="grid gap-4 md:grid-cols-2 md:gap-6">
        {(['border-(--color-side-red)/30', 'border-(--color-side-blue)/30'] as const).map((border) => (
          <div key={border} className={`h-[496px] rounded-3xl md:h-[331px] border ${border} bg-ink-900/85`} />
        ))}
      </div>
      <div className="mx-auto h-12 w-full rounded-xl bg-white/5 sm:w-64" />
    </div>
  );
}
