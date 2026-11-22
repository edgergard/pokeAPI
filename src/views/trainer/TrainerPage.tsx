'use client';

import { useState } from 'react';
import Link from 'next/link';
import { RotateCcw } from 'lucide-react';
import {
  getTrainerTalent,
  learnTrainerTalent,
  nextTrainerTalentPointLevel,
  resetTrainerTalents,
  teamSlots,
  xpToNextTrainerLevel,
} from '@/entities/progression';
import { updateSave, useSave, useSaveStatus, type Save } from '@/entities/save';
import { economy } from '@/shared/config/economy';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import { TalentTree } from '@/widgets/talent-tree';
import { nextPointText, trainerTalentLayout, trainerTalentNodes } from './model/trainer';
import { TrainerName } from './ui/TrainerName';
import { UnlockTimeline } from './ui/UnlockTimeline';

const { groups: TRAINER_GROUPS } = trainerTalentLayout();

type Announcement = { text: string; n: number };

/** Trainer screen (design.md `trainer`): name, level, unlock timeline and the trainer talent tree. */
export function TrainerPage() {
  const { status } = useSaveStatus();
  return (
    <main id="content" className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:py-14">
      <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Trainer</h1>
      {status === 'ready' ? (
        <TrainerContent />
      ) : status === 'loading' ? (
        <TrainerSkeleton />
      ) : (
        <SaveUnavailable />
      )}
    </main>
  );
}

function TrainerContent() {
  const trainer = useSave((s) => s.trainer);
  const [announcement, setAnnouncement] = useState<Announcement>({ text: '', n: 0 });
  const [confirmReset, setConfirmReset] = useState(false);

  if (!trainer) return null;

  const announce = (text: string) => setAnnouncement((a) => ({ text, n: a.n + 1 }));
  const save: Pick<Save, 'trainer'> = { trainer };

  const learn = (id: string) => {
    const captured = { learned: false };
    updateSave((s) => {
      const result = learnTrainerTalent(s, id);
      captured.learned = result.ok;
      return result.ok ? result.save : s;
    });
    if (captured.learned) announce(`Learned ${getTrainerTalent(id)?.name ?? 'talent'}`);
  };

  const reset = () => {
    const refunded = trainer.talents.length;
    updateSave(resetTrainerTalents);
    setConfirmReset(false);
    announce(`Trainer talents reset. ${refunded} ${refunded === 1 ? 'point' : 'points'} refunded.`);
  };

  return (
    <>
      <TrainerSummary trainer={trainer} onRenamed={(name) => announce(`Name saved: ${name}`)} />

      <p role="status" className="sr-only" data-testid="trainer-status">
        {announcement.text && <span key={announcement.n}>{announcement.text}</span>}
      </p>

      <UnlockTimeline level={trainer.level} />

      <TalentTree
        variant="trainer"
        title="Trainer talents"
        groups={TRAINER_GROUPS}
        nodes={trainerTalentNodes(save)}
        pointsAvailable={trainer.talentPoints}
        pointsNote={nextPointText(nextTrainerTalentPointLevel(trainer.level))}
        onLearn={learn}
        onReset={() => setConfirmReset(true)}
        resetLabel="Reset tree"
      />

      <Dialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset the trainer tree?"
        description="Every learned talent is cleared and its point comes back. Resetting is free."
        footer={
          <>
            <Button
              variant="outline"
              size="lg"
              onClick={() => setConfirmReset(false)}
              className="cursor-pointer justify-center"
            >
              Cancel
            </Button>
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-12 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-destructive px-5 text-base font-semibold text-primary-foreground transition-colors hover:bg-destructive/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <RotateCcw aria-hidden className="size-4" />
              Reset tree
            </button>
          </>
        }
      >
        <p className="text-sm text-foreground">
          {trainer.talents.length === 1
            ? '1 talent point comes back:'
            : `${trainer.talents.length} talent points come back:`}
        </p>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {trainer.talents.map((id) => (
            <li key={id} className="rounded-full bg-secondary px-3 py-1 text-sm">
              {getTrainerTalent(id)?.name ?? id}
            </li>
          ))}
        </ul>
      </Dialog>
    </>
  );
}

function TrainerSummary({
  trainer,
  onRenamed,
}: {
  trainer: Save['trainer'];
  onRenamed: (name: string) => void;
}) {
  const atMax = trainer.level >= economy.trainer.maxLevel;
  const need = xpToNextTrainerLevel(trainer.level);
  const slots = teamSlots(trainer.level);

  return (
    <section
      aria-label="Trainer profile"
      className="flex flex-col gap-5 rounded-3xl p-5 glass sm:p-6"
    >
      <TrainerName name={trainer.name} onSaved={onRenamed} />
      <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
        <div className="flex min-w-60 flex-1 flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-display text-2xl font-extrabold">
              Lv {trainer.level}{' '}
              <span className="font-semibold text-muted-foreground">
                / {economy.trainer.maxLevel}
              </span>
            </p>
            <span className="font-mono text-xs text-muted-foreground">
              {atMax ? 'Max level' : `${trainer.xp} / ${need} XP`}
            </span>
          </div>
          <div
            role="progressbar"
            aria-label={atMax ? 'Trainer level' : `Trainer XP to level ${trainer.level + 1}`}
            aria-valuemin={0}
            aria-valuemax={atMax ? 1 : need}
            aria-valuenow={atMax ? 1 : trainer.xp}
            aria-valuetext={atMax ? 'Max level' : `${trainer.xp} of ${need} XP`}
            className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500"
              style={{ width: `${atMax ? 100 : Math.min(100, (trainer.xp / need) * 100)}%` }}
            />
          </div>
        </div>
        <dl className="flex gap-6 text-sm">
          <div className="flex flex-col">
            <dt className="text-muted-foreground">Team size</dt>
            <dd className="font-mono text-lg font-bold text-foreground">{slots}</dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-muted-foreground">Talents learned</dt>
            <dd className="font-mono text-lg font-bold text-foreground">
              {trainer.talents.length}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

function TrainerSkeleton() {
  return (
    <div role="status" aria-label="Loading trainer" className="flex flex-col gap-6">
      <div className="shimmer relative h-40 overflow-hidden rounded-3xl bg-card" />
      <div className="shimmer relative h-36 overflow-hidden rounded-3xl bg-card" />
      <div className="shimmer relative h-96 overflow-hidden rounded-3xl bg-card" />
    </div>
  );
}

function SaveUnavailable() {
  return (
    <div role="alert" className="flex flex-col items-start gap-4 rounded-3xl p-6 glass">
      <p className="text-foreground">
        Your save couldn&apos;t be loaded, so your trainer is hidden.
      </p>
      <Link
        href="/settings/"
        className="inline-flex h-12 items-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Open Settings
      </Link>
    </div>
  );
}
