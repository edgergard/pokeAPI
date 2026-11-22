import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { loadMovesets, type BattleResult } from '@/entities/battle';
import type { CapsuleResult } from '@/entities/capsule';
import type { BattleSummary } from '@/entities/progression';
import { getSave, requestPersist, useSave, type Save } from '@/entities/save';
import { useOpenCapsule } from '@/features/open-capsule';
import { CAPSULE_TIERS, economy } from '@/shared/config/economy';
import { Spinner } from '@/shared/ui/Spinner';
import { CapsuleReveal } from '@/widgets/capsule-reveal';
import {
  commitIntroWin,
  finishOnboarding,
  markCapsuleOpened,
  storeIntroRival,
} from '../model/commit';
import { setupIntro, type IntroSetup } from '../model/fighters';
import { resultPhrase } from '../model/suggestion';
import { Arena, preloadArena } from './Arena';
import { IntroResult } from './IntroResult';

type Setup = IntroSetup | 'loading' | 'error';

/** The first Pokémon: the collection entry obtained first (as Home resumes the `capsule` step). */
export function firstOwnedId(collection: Save['collection']): number | null {
  let first: { id: number; at: number } | null = null;
  for (const owned of Object.values(collection)) {
    if (
      !first ||
      owned.obtainedAt < first.at ||
      (owned.obtainedAt === first.at && owned.speciesId < first.id)
    ) {
      first = { id: owned.speciesId, at: owned.obtainedAt };
    }
  }
  return first?.id ?? null;
}

/**
 * Where the intro resumes: `fought` waits for "Open capsule"; `capsule` (also `fought` with no
 * basic capsule left and a Pokémon already owned) waits for "Add to team".
 */
export function introStep(
  save: Pick<Save, 'onboarding' | 'capsules' | 'collection'>,
): 'dealt' | 'fought' | 'capsule' | 'other' {
  const { step } = save.onboarding;
  if (step === 'fought' && save.capsules.basic === 0 && firstOwnedId(save.collection) !== null) {
    return 'capsule';
  }
  return step === 'dealt' || step === 'fought' || step === 'capsule' ? step : 'other';
}

const INTRO_CAPSULES = CAPSULE_TIERS.reduce(
  (n, tier) =>
    n + ((economy.onboarding.introReward.capsules as Partial<Record<string, number>>)[tier] ?? 0),
  0,
);

/**
 * The onboarding battle (`/battle/?stage=intro`, design.md flow `first-visit` steps 3–5): the
 * loaner beats the dealt rival in a scripted 1×1, the win pays the intro reward once (step
 * `fought`), "Open capsule" reveals the first Pokémon (step `capsule`) and "Add to team" makes it
 * the team (step `done`) and goes Home. A reload at `fought` or `capsule` resumes the result
 * without fighting again.
 */
export function IntroBattle({ onArena }: { onArena: (active: boolean) => void }) {
  const router = useRouter();
  const { openOne } = useOpenCapsule();
  const resume = useSave((s) => introStep(s));
  const owned = useSave((s) => firstOwnedId(s.collection));
  // Fight only when the page opened at `dealt`; later steps (here or after a reload) show the result.
  const [mode] = useState<'arena' | 'resume'>(() =>
    getSave()?.onboarding.step === 'dealt' ? 'arena' : 'resume',
  );
  const [setup, setSetup] = useState<Setup>('loading');
  const [summary, setSummary] = useState<BattleSummary | null>(null);
  const [reveal, setReveal] = useState<{ results: CapsuleResult[]; open: boolean } | null>(null);
  const [openError, setOpenError] = useState(false);
  const committed = useRef(false);

  useEffect(() => {
    if (mode !== 'arena') return;
    preloadArena();
    let cancelled = false;
    loadMovesets().then(
      (movesets) => {
        if (cancelled) return;
        const save = getSave();
        const next = save ? setupIntro(save, movesets) : null;
        if (!next) {
          setSetup('error');
          return;
        }
        storeIntroRival(next.rivalId);
        setSetup(next);
      },
      () => {
        if (!cancelled) setSetup('error');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [mode]);

  const arenaOn = mode === 'arena' && typeof setup === 'object';
  useEffect(() => {
    onArena(arenaOn);
    return () => onArena(false);
  }, [arenaOn, onArena]);

  const onFinished = (result: BattleResult) => {
    if (committed.current) return;
    committed.current = true;
    setSummary(commitIntroWin(result));
  };

  const openCapsule = () => {
    // Only the capsule the intro paid (a fast double click must not open a second one).
    if (getSave()?.onboarding.step !== 'fought') return;
    const out = openOne('basic');
    if (!out.ok) {
      setOpenError(true);
      return;
    }
    setOpenError(false);
    // openOne committed the pull; now the step moves on, so a reload shows "Add to team".
    markCapsuleOpened();
    setReveal({ results: out.results, open: true });
  };

  const addToTeam = (speciesId: number) => {
    finishOnboarding(speciesId);
    // Asked from this click (a user gesture); it resolves on its own.
    void requestPersist();
    router.push('/');
  };

  const step = resume === 'capsule' ? 'capsule' : 'fought';
  const newSpeciesId = reveal?.results[0]?.speciesId ?? owned ?? null;
  const capsules = summary
    ? CAPSULE_TIERS.reduce((n, tier) => n + summary.capsules[tier], 0)
    : INTRO_CAPSULES;
  const result = (variant: 'overlay' | 'panel') => (
    <IntroResult
      variant={variant}
      step={step}
      capsules={capsules}
      newSpeciesId={newSpeciesId}
      openError={openError}
      onOpenCapsule={openCapsule}
      onAddToTeam={addToTeam}
    />
  );

  return (
    <>
      <header>
        <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          First battle
        </h1>
      </header>

      {mode === 'resume' ? (
        <div data-phase="result">{result('panel')}</div>
      ) : setup === 'loading' ? (
        <div className="grid aspect-[4/5] place-items-center rounded-3xl border border-white/10 bg-background min-[480px]:aspect-[4/3] md:aspect-video">
          <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground">
            <Spinner className="size-7" label="Preparing arena" />
            Preparing arena
          </div>
        </div>
      ) : setup === 'error' ? (
        <div
          role="alert"
          className="flex flex-col items-center gap-4 rounded-3xl border border-white/10 bg-card px-6 py-10 text-center"
        >
          <p>The first battle couldn&apos;t start.</p>
          <Link
            href="/"
            className="tap-target font-semibold text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Back to Home
          </Link>
        </div>
      ) : (
        <section aria-label="Battle" data-phase="arena">
          <Arena
            red={setup.red}
            blue={setup.blue}
            seed={setup.seed}
            intro
            onFinished={onFinished}
            resultMessage={() => resultPhrase({ won: true, capsules, trainerLevel: null })}
            renderResult={() => result('overlay')}
          />
        </section>
      )}

      {reveal && (
        <CapsuleReveal
          results={reveal.results}
          open={reveal.open}
          onClose={() => setReveal((r) => r && { ...r, open: false })}
          primaryLabel="Add to team"
          onPrimary={() => {
            const id = reveal.results[0]?.speciesId;
            if (id !== undefined) addToTeam(id);
          }}
        />
      )}
    </>
  );
}
