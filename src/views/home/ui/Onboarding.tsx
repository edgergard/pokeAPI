'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { loadMovesets } from '@/entities/battle';
import { CapsuleArt, type RevealResult } from '@/entities/capsule';
import { getSpecies } from '@/entities/pokemon';
import { getSave, requestPersist, updateSave, useSave } from '@/entities/save';
import { useOpenCapsule } from '@/features/open-capsule';
import { economy } from '@/shared/config/economy';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { CapsuleReveal } from '@/widgets/capsule-reveal';
import { HoloCard } from '@/widgets/team-showcase';
import { HeroHeading } from '../HeroHeading';
import { dealOnboarding } from '../model/dealOnboarding';
import { addFirstToTeam, commitDeal, firstOwned, markCapsuleOpened } from '../model/onboarding';
import { eyebrow, primaryLinkLarge } from './styles';

export type OnboardingView = 'loading' | 'hero' | 'dealt' | 'fought' | 'capsule';

type Announce = (text: string) => void;

const speciesName = (id: number | null | undefined) =>
  (id ? getSpecies(id)?.name : undefined) ?? 'Pokémon';

const DEAL_FAILED = 'Couldn’t deal your cards. Check your connection and try again.';
const OPEN_FAILED = 'Couldn’t open. Try again';

/**
 * Home before the first Pokémon (design.md screen `home`, flow first-visit steps 1–2 and the reload
 * resume of steps 4–5). Each transition is one `updateSave`, so a reload lands on the same step.
 */
export function Onboarding({ view, announce }: { view: OnboardingView; announce: Announce }) {
  /** The first capsule's reveal outlives the step change it causes (fought → capsule). */
  const [reveal, setReveal] = useState<RevealResult[] | null>(null);
  const [revealOpen, setRevealOpen] = useState(false);

  const addToTeam = (speciesId: number) => {
    updateSave((s) => addFirstToTeam(s, speciesId));
    // From this click: Firefox only shows its persistence prompt for a user gesture. Memoised per load.
    void requestPersist();
    announce(`${speciesName(speciesId)} joined your team`);
  };

  return (
    <div className="relative flex flex-1 flex-col items-center justify-center">
      {view === 'loading' || view === 'hero' ? (
        <Hero loading={view === 'loading'} announce={announce} />
      ) : (
        <div className="flex w-full max-w-5xl flex-col items-center gap-8 pt-6 text-center">
          <h1 className={cn(eyebrow, 'text-primary')}>Trainer Studio</h1>
          {view === 'dealt' && <Dealt announce={announce} />}
          {view === 'fought' && (
            <PendingCapsule
              onOpened={(results) => {
                setReveal(results);
                setRevealOpen(true);
              }}
            />
          )}
          {view === 'capsule' && <AddFirst onAdd={addToTeam} />}
        </div>
      )}

      {reveal && (
        <CapsuleReveal
          results={reveal}
          open={revealOpen}
          onClose={() => setRevealOpen(false)}
          title="Your first capsule"
          primaryLabel="Add to team"
          onPrimary={() => {
            const first = reveal[0];
            setRevealOpen(false);
            if (first) addToTeam(first.speciesId);
          }}
        />
      )}
    </div>
  );
}

function Hero({ loading, announce }: { loading: boolean; announce: Announce }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const busyRef = useRef(false);

  const deal = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setFailed(false);
    try {
      const movesets = await loadMovesets();
      const save = getSave();
      if (!save) throw new Error('save not loaded');
      const picked = dealOnboarding(save, movesets);
      updateSave((s) => commitDeal(s, picked));
      announce(`Loaner ${speciesName(picked.loanerSpeciesId)} joined your team`);
    } catch {
      setFailed(true);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <section
      data-step="hero"
      className="grid w-full max-w-6xl items-center gap-12 pt-4 lg:grid-cols-[1fr_auto] lg:gap-16 lg:pt-12"
    >
      <div className="flex flex-col gap-5">
        <h1 className={cn(eyebrow, 'text-primary')}>Trainer Studio</h1>
        <HeroHeading />
        <p className="max-w-md text-lg leading-relaxed text-muted-foreground">
          Open capsules, train your team and watch it battle in 3D. No account, no money — your
          progress stays in this browser.
        </p>
        <div className="mt-2 flex min-h-14 flex-wrap items-center gap-3">
          {loading ? (
            <>
              <span
                aria-hidden
                data-testid="home-skeleton"
                className="shimmer relative h-14 w-80 max-w-full overflow-hidden rounded-2xl bg-card"
              />
              <span className="sr-only">Loading your save…</span>
            </>
          ) : (
            <>
              <Button
                size="lg"
                onClick={deal}
                aria-busy={busy || undefined}
                aria-disabled={busy || undefined}
                className="h-14 cursor-pointer rounded-2xl px-7 text-base"
              >
                {busy && (
                  <span
                    aria-hidden
                    className="size-4 animate-spin rounded-full border-2 border-primary-foreground/25 border-t-primary-foreground"
                  />
                )}
                Fill my team with random Pokémon
              </Button>
              <span className="text-sm text-muted-foreground">Takes about a minute</span>
            </>
          )}
        </div>
        {failed && (
          <p role="alert" className="text-sm font-semibold text-destructive">
            {DEAL_FAILED}
          </p>
        )}
      </div>
      <CardBack />
    </section>
  );
}

/** The face-down card next to the hero copy (decorative). */
function CardBack() {
  return (
    <div
      aria-hidden
      className="mx-auto hidden h-[26rem] w-72 -rotate-6 place-items-center rounded-3xl border border-white/12 bg-gradient-to-br from-secondary to-muted shadow-[0_30px_80px_-30px_rgb(94_176_255/0.45)] sm:grid"
    >
      <div className="grid h-[22rem] w-60 place-items-center rounded-2xl border-2 border-primary/50 bg-[repeating-linear-gradient(45deg,rgb(255_210_63/0.1)_0_12px,rgb(94_176_255/0.1)_12px_24px)]">
        <CapsuleArt tier="basic" className="w-24" />
      </div>
    </div>
  );
}

function Dealt({ announce }: { announce: Announce }) {
  const onboarding = useSave((s) => s.onboarding);
  const fightRef = useRef<HTMLAnchorElement>(null);
  const loanerId = onboarding?.loanerSpeciesId ?? null;
  const rivalId = onboarding?.rivalSpeciesId ?? null;
  const loanerName = speciesName(loanerId);

  useEffect(() => {
    fightRef.current?.focus({ preventScroll: true });
    // Start fetching the 3D arena while the player looks at the cards; a failure only loses the head start.
    import('@/widgets/battle-arena').catch(() => {});
  }, []);

  useEffect(() => {
    announce(`Loaner ${loanerName} joined your team`);
  }, [announce, loanerName]);

  if (loanerId === null || rivalId === null) return null;

  return (
    <section
      aria-label="Your first battle"
      data-step="dealt"
      className="flex w-full flex-col items-center gap-8"
    >
      <h2 className="font-display text-3xl font-extrabold tracking-tight">Your first battle</h2>
      <p className="-mt-4 max-w-xl text-base text-muted-foreground">
        Loaner {loanerName} joined your team. Win one battle to earn your first capsule.
      </p>
      <div className="flex w-full flex-col items-center justify-center gap-6 sm:flex-row sm:gap-12">
        <HoloCard
          variant="large"
          speciesId={loanerId}
          level={economy.onboarding.loanerLevel}
          tag={{ label: 'Loaner', tone: 'loaner' }}
          className="card-deal"
        />
        <span aria-hidden className="font-display text-4xl font-extrabold text-muted-foreground">
          VS
        </span>
        <span className="sr-only">versus</span>
        <HoloCard
          variant="large"
          speciesId={rivalId}
          level={economy.onboarding.rivalLevel}
          tag={{ label: 'Rival', tone: 'rival' }}
          className="card-deal"
        />
      </div>
      <Link ref={fightRef} href="/battle/?stage=intro" prefetch className={primaryLinkLarge}>
        Fight
      </Link>
    </section>
  );
}

function PendingCapsule({ onOpened }: { onOpened: (results: RevealResult[]) => void }) {
  const { openOne } = useOpenCapsule();
  const [failed, setFailed] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    buttonRef.current?.focus({ preventScroll: true });
  }, []);

  const open = () => {
    // The pull is committed to the save before anything animates.
    const out = openOne('basic');
    if (!out.ok) {
      setFailed(true);
      return;
    }
    setFailed(false);
    // Right after the commit: a reload now shows "Add to team" instead of rolling again.
    updateSave(markCapsuleOpened);
    onOpened(out.results);
  };

  return (
    <section
      aria-labelledby="capsule-title"
      data-step="fought"
      className="flex flex-col items-center gap-6"
    >
      <h2 id="capsule-title" className="font-display text-3xl font-extrabold tracking-tight">
        Victory! Your first capsule is waiting.
      </h2>
      <CapsuleArt tier="basic" className="w-32" />
      <Button
        ref={buttonRef}
        size="lg"
        onClick={open}
        className="h-14 cursor-pointer rounded-2xl px-8 text-base"
      >
        Open your capsule
      </Button>
      {failed && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {OPEN_FAILED}
        </p>
      )}
    </section>
  );
}

function AddFirst({ onAdd }: { onAdd: (speciesId: number) => void }) {
  const first = useSave(firstOwned);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    buttonRef.current?.focus({ preventScroll: true });
  }, []);

  if (!first) return null;
  const name = speciesName(first.speciesId);

  return (
    <section
      aria-labelledby="first-title"
      data-step="capsule"
      className="flex flex-col items-center gap-6"
    >
      <h2 id="first-title" className="font-display text-3xl font-extrabold tracking-tight">
        {name} joined your collection.
      </h2>
      <HoloCard
        variant="large"
        speciesId={first.speciesId}
        level={first.level}
        stars={first.stars}
      />
      <Button
        ref={buttonRef}
        size="lg"
        onClick={() => onAdd(first.speciesId)}
        className="h-14 cursor-pointer rounded-2xl px-8 text-base"
      >
        Add to team
      </Button>
    </section>
  );
}
