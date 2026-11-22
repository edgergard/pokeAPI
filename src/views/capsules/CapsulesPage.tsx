'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { isTierUnlocked, type RevealResult } from '@/entities/capsule';
import { useSave, useSaveStatus } from '@/entities/save';
import { useCraft, useOpenCapsule } from '@/features/open-capsule';
import { CAPSULE_TIERS, type CapsuleTier } from '@/shared/config/economy';
import { CapsuleReveal, OddsPity, type RevealPrimaryLabel } from '@/widgets/capsule-reveal';
import { CraftList, DustBalance } from './CraftList';
import { EmptyCapsules, TierStacks, linkButtonClass } from './TierStacks';

/** After the dialog's exit (300 ms fallback) so the native focus restore has already happened. */
const FOCUS_AFTER_CLOSE_MS = 350;

type Reveal = {
  results: RevealResult[];
  /** Tier of a capsule reveal (null for a craft): enables "Open next". */
  tier: CapsuleTier | null;
};

type Failure = { message: string; retry: () => void };

/** Capsules screen (design.md `capsules`): open capsules, honest odds and pity, craft with dust. */
export function CapsulesPage() {
  const { status } = useSaveStatus();
  const headingRef = useRef<HTMLHeadingElement>(null);

  return (
    <main id="content" className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:py-14">
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="font-display text-4xl font-extrabold tracking-tight outline-none sm:text-5xl"
      >
        Capsules
      </h1>
      {status === 'ready' ? (
        <CapsulesContent headingRef={headingRef} />
      ) : (
        <>
          {status === 'loading' ? <StacksSkeleton /> : <SaveUnavailable />}
          {/* The odds are static data: always visible, even before the save loads. */}
          <OddsPity />
          {status === 'loading' && <CraftSkeleton />}
        </>
      )}
    </main>
  );
}

function CapsulesContent({ headingRef }: { headingRef: RefObject<HTMLHeadingElement | null> }) {
  const capsules = useSave((s) => s.capsules);
  const level = useSave((s) => s.trainer.level);
  const dust = useSave((s) => s.dust);
  const cleared = useSave((s) => s.ladder.cleared);
  const collection = useSave((s) => s.collection);
  const { openOne, openAll } = useOpenCapsule();
  const { craft } = useCraft();
  const router = useRouter();

  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [revealOpen, setRevealOpen] = useState(false);
  const [failure, setFailure] = useState<Failure | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const focusTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(focusTimer.current), []);

  if (!capsules || level === undefined || dust === undefined || !collection) return null;

  const open = (tier: CapsuleTier, all: boolean) => {
    // The roll is committed to the save here, before the dialog animates anything.
    const out = all ? openAll(tier) : openOne(tier);
    if (!out.ok) {
      setFailure({ message: "Couldn't open.", retry: () => open(tier, all) });
      return;
    }
    setFailure(null);
    setReveal({ results: out.results, tier });
    setRevealOpen(true);
  };

  const buy = (speciesId: number) => {
    const out = craft(speciesId);
    if (!out.ok) {
      setFailure({ message: "Couldn't craft.", retry: () => buy(speciesId) });
      return;
    }
    setFailure(null);
    setReveal({ results: [out.result], tier: null });
    setRevealOpen(true);
  };

  const close = () => {
    setRevealOpen(false);
    const crafted = reveal?.tier === null;
    // The control that opened the dialog may be gone (last capsule opened, crafted row removed).
    clearTimeout(focusTimer.current);
    focusTimer.current = setTimeout(() => {
      const active = document.activeElement;
      if (active && active !== document.body && document.contains(active)) return;
      (crafted ? searchRef.current : headingRef.current)?.focus({ preventScroll: true });
    }, FOCUS_AFTER_CLOSE_MS);
  };

  const firstNew = reveal?.results.find((r) => r.outcome === 'new');
  const primaryLabel: RevealPrimaryLabel = firstNew ? 'View new' : 'Done';
  const onPrimary = () => {
    if (firstNew) router.push(`/creature/?id=${firstNew.speciesId}`);
    close();
  };

  const nextTier = reveal?.tier ?? null;
  const canOpenNext =
    nextTier !== null && capsules[nextTier] > 0 && isTierUnlocked({ trainer: { level } }, nextTier);

  const total = CAPSULE_TIERS.reduce((sum, tier) => sum + capsules[tier], 0);

  return (
    <>
      <div className="-mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground">Open what you earned in play.</p>
        <DustBalance dust={dust} />
      </div>

      {failure && (
        <p
          role="alert"
          className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-foreground"
        >
          <span>{failure.message}</span>{' '}
          <button
            type="button"
            onClick={failure.retry}
            className="tap-target cursor-pointer font-semibold text-destructive underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Try again
          </button>
        </p>
      )}

      <section aria-labelledby="capsule-stacks-heading" className="flex flex-col gap-4">
        <h2 id="capsule-stacks-heading" className="font-display text-xl font-bold tracking-tight">
          Your capsules
        </h2>
        {total === 0 ? (
          <EmptyCapsules cleared={cleared ?? 0} />
        ) : (
          <TierStacks capsules={capsules} trainerLevel={level} onOpen={open} />
        )}
      </section>

      <OddsPity />

      <CraftList dust={dust} collection={collection} onCraft={buy} searchRef={searchRef} />

      {reveal && (
        <CapsuleReveal
          results={reveal.results}
          open={revealOpen}
          onClose={close}
          title={reveal.tier === null ? 'Crafted with dust' : 'Capsule'}
          primaryLabel={primaryLabel}
          onPrimary={onPrimary}
          onOpenNext={canOpenNext && nextTier ? () => open(nextTier, false) : undefined}
        />
      )}
    </>
  );
}

function StacksSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading capsules"
      data-testid="capsules-skeleton"
      className="grid gap-4 sm:grid-cols-2"
    >
      <div className="shimmer relative h-36 overflow-hidden rounded-3xl bg-card" />
      <div className="shimmer relative h-36 overflow-hidden rounded-3xl bg-card" />
    </div>
  );
}

function CraftSkeleton() {
  return <div aria-hidden className="shimmer relative h-96 overflow-hidden rounded-3xl bg-card" />;
}

function SaveUnavailable() {
  return (
    <div role="alert" className="flex flex-col items-start gap-4 rounded-3xl p-6 glass">
      <p className="text-foreground">
        Your save couldn&apos;t be loaded, so capsules can&apos;t open.
      </p>
      <Link href="/" className={linkButtonClass}>
        Go to Home
      </Link>
    </div>
  );
}
