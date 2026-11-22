'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  allStages,
  collectionTeamPower,
  isLadderComplete,
  nextStageToFight,
  stageStatus,
  type StageInfo,
} from '@/entities/ladder';
import { teamSlots } from '@/entities/progression';
import { useSave, useSaveStatus } from '@/entities/save';
import { economy } from '@/shared/config/economy';
import { useHydrated } from '@/shared/lib/useHydrated';
import { Button } from '@/shared/ui/Button';
import { TeamDialog } from '@/widgets/team-dialog';
import { LadderPath } from './ui/LadderPath';
import { StagePanel } from './ui/StagePanel';

/** Ladder (design.md screen `ladder`): pick a stage and look at its rival (Must #6). */
export function LadderPage() {
  const { status } = useSaveStatus();
  const hydrated = useHydrated();
  return (
    <main id="content" className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-10 sm:py-14">
      <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Ladder</h1>
      {/* Present from the first paint, so the notice filled in after hydration is announced. */}
      <div role="status">{hydrated && <RedirectNotice />}</div>
      {status === 'ready' ? (
        <LadderContent />
      ) : status === 'loading' ? (
        <LadderSkeleton />
      ) : (
        <div role="alert" className="flex flex-col items-start gap-4 rounded-3xl p-6 glass">
          <p>Your save couldn&apos;t be loaded.</p>
          <Link
            href="/"
            className="tap-target font-semibold text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Go to Home
          </Link>
        </div>
      )}
    </main>
  );
}

/** "Stage locked" after the battle page bounced a locked or invalid `?stage` here. */
function RedirectNotice() {
  const params = useSearchParams();
  const locked = Number(params.get('locked'));
  if (!params.has('locked') && !params.has('invalid')) return null;
  const hint = Number.isInteger(locked) && locked > 1 ? ` Clear stage ${locked - 1} first.` : '';
  return (
    <p className="rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm text-foreground">
      <span className="font-semibold">Stage locked</span>
      {hint}
    </p>
  );
}

function loadStages(): StageInfo[] | null {
  try {
    return allStages();
  } catch {
    return null;
  }
}

function LadderContent() {
  const router = useRouter();
  const step = useSave((s) => s.onboarding.step);
  const ladder = useSave((s) => s.ladder);
  const team = useSave((s) => s.team);
  const collection = useSave((s) => s.collection);
  const level = useSave((s) => s.trainer.level);
  const [stages] = useState(loadStages);
  const [selected, setSelected] = useState<number | null>(null);
  const [teamOpen, setTeamOpen] = useState(false);
  const [lockedMessage, setLockedMessage] = useState('');
  const onboarding = step !== undefined && step !== 'done';

  // The ladder opens once onboarding has given the player a Pokémon.
  useEffect(() => {
    if (onboarding) router.replace('/');
  }, [onboarding, router]);

  if (!stages) {
    return (
      <div role="alert" className="flex flex-col items-start gap-4 rounded-3xl p-6 glass">
        <p>Couldn&apos;t load stages.</p>
        <Button onClick={() => window.location.reload()} className="cursor-pointer">
          Reload
        </Button>
      </div>
    );
  }
  if (onboarding || !ladder || !team || !collection || level === undefined) {
    return <LadderSkeleton />;
  }

  const save = { ladder };
  const current = nextStageToFight(save);
  const shown = selected ?? current;
  const info = stages[shown - 1];
  const status = stageStatus(save, shown);
  const owned = Object.keys(collection).length;
  const fillTeam = team.length < teamSlots(level) && owned > team.length;

  return (
    <>
      <div className="-mt-3 flex flex-col gap-2">
        <p className="font-mono text-sm text-muted-foreground tabular-nums">
          Stage {ladder.cleared} / {economy.battle.ladderStages} cleared
        </p>
        {isLadderComplete(save) && (
          <p className="text-foreground">Ladder complete. Replay any stage for XP and capsules.</p>
        )}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <LadderPath
          stages={stages}
          statusOf={(stage) => stageStatus(save, stage)}
          selected={shown}
          onSelect={(stage) => {
            setSelected(stage);
            setLockedMessage('');
          }}
          onLocked={setLockedMessage}
        />
        <div className="flex flex-col gap-3 lg:sticky lg:top-24">
          {info && status !== 'locked' && (
            <StagePanel
              info={info}
              status={status}
              yourPower={collectionTeamPower(collection, team)}
              replayWins={ladder.replayWins}
              fillTeam={fillTeam}
              onEditTeam={() => setTeamOpen(true)}
            />
          )}
        </div>
      </div>
      <p role="status" className="sr-only">
        {lockedMessage}
      </p>

      <TeamDialog open={teamOpen} onClose={() => setTeamOpen(false)} />
    </>
  );
}

function LadderSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading stages"
      data-testid="ladder-skeleton"
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]"
    >
      <div className="shimmer relative h-96 overflow-hidden rounded-3xl bg-card" />
      <div className="shimmer relative h-96 overflow-hidden rounded-3xl bg-card" />
    </div>
  );
}
