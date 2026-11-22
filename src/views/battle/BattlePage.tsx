'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSave, useSaveStatus } from '@/entities/save';
import { useHydrated } from '@/shared/lib/useHydrated';
import { BattleAmbient } from './BattleAmbient';
import { resolveBattleRoute } from './model/route';
import { IntroBattle } from './ui/IntroBattle';
import { StageBattle } from './ui/StageBattle';

/**
 * Battle (design.md screen `battle`): `/battle/?stage=N` (ladder) or `?stage=intro` (onboarding),
 * one route with three phases — preview → arena → result. The query and the save are browser-only:
 * until hydration a same-size placeholder stands in.
 */
export default function BattlePage() {
  const hydrated = useHydrated();
  const [arenaActive, setArenaActive] = useState(false);
  return (
    <main
      id="content"
      className="relative isolate mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:py-12"
    >
      <BattleAmbient paused={arenaActive} />
      {hydrated ? <BattleRouteView onArena={setArenaActive} /> : <BattlePlaceholder />}
    </main>
  );
}

/**
 * Reads `?stage` — rendered only after hydration, so useSearchParams never runs during prerender
 * (no `<Suspense>`: it broke hydration in `next dev`) — validates it against the save and shows
 * the battle or redirects (Home before onboarding is done, the ladder for a locked/invalid stage).
 */
function BattleRouteView({ onArena }: { onArena: (active: boolean) => void }) {
  const raw = useSearchParams().get('stage');
  const router = useRouter();
  const { status } = useSaveStatus();
  const route = useSave((s) => resolveBattleRoute(s, raw));
  const [attempt, setAttempt] = useState(0);
  const redirect = route?.kind === 'redirect' ? route.to : null;

  useEffect(() => {
    if (redirect) router.replace(redirect);
  }, [redirect, router]);

  if (status === 'error') return <SaveUnavailable />;
  if (!route || route.kind === 'redirect') return <BattlePlaceholder />;
  if (route.kind === 'intro') return <IntroBattle onArena={onArena} />;
  return (
    <StageBattle
      key={`${route.stage}:${attempt}`}
      stage={route.stage}
      onRetry={() => setAttempt((n) => n + 1)}
      onArena={onArena}
    />
  );
}

/** Same footprint as the preview (title, two lineups, actions), so nothing jumps when it loads. */
function BattlePlaceholder() {
  return (
    <>
      <header className="flex flex-col gap-3">
        <div aria-hidden className="h-9 w-32 rounded-lg bg-white/5" />
        <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Battle</h1>
        <div aria-hidden className="h-4 w-64 max-w-full rounded bg-white/5" />
      </header>
      <div
        role="status"
        aria-busy="true"
        aria-label="Loading the battle"
        data-phase="loading"
        className="grid gap-4 md:grid-cols-[1fr_auto_1fr]"
      >
        <div className="shimmer relative h-56 overflow-hidden rounded-3xl bg-card" />
        <span className="hidden w-8 md:block" />
        <div className="shimmer relative h-56 overflow-hidden rounded-3xl bg-card" />
      </div>
      <div aria-hidden className="h-12 w-full rounded-xl bg-white/5 sm:w-64" />
    </>
  );
}

function SaveUnavailable() {
  return (
    <>
      <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Battle</h1>
      <div role="alert" className="flex flex-col items-start gap-4 rounded-3xl p-6 glass">
        <p>Your save couldn&apos;t be loaded, so battles can&apos;t start.</p>
        <Link
          href="/"
          className="tap-target font-semibold text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Go to Home
        </Link>
      </div>
    </>
  );
}
