'use client';

import { useEffect, useRef } from 'react';
import { DocumentLink } from '@/shared/ui/DocumentLink';
import Link from 'next/link';
import { ChevronRight, LayoutGrid, Swords, UserRound } from 'lucide-react';
import { getSpecies, SPECIES_COUNT, typeColor } from '@/entities/pokemon';
import { talentPointsAvailable, teamSlots, xpToNextTrainerLevel } from '@/entities/progression';
import type { Save } from '@/entities/save';
import { cn } from '@/shared/lib/cn';
import { DUR, EASE, usePrefersReducedMotion } from '@/shared/lib/motion';
import { CreatureArt } from '@/widgets/capsule-reveal';
import { HoloCard } from '@/widgets/team-showcase';
import { nextStageView, nextUnlockText, teamStrip, type RivalPreview } from '../model/hub';
import { eyebrow, outlineLink, panel, primaryLink } from './styles';

/** Trainer name, level, XP towards the next level and the next unlock. */
export function TrainerStrip({ trainer }: { trainer: Save['trainer'] }) {
  const max = xpToNextTrainerLevel(trainer.level);
  const xp = Math.min(trainer.xp, max);
  const next = nextUnlockText(trainer.level);
  return (
    <section
      aria-labelledby="trainer-name"
      className="flex flex-col gap-4 rounded-3xl p-5 glass sm:flex-row sm:items-center sm:gap-6 sm:p-6"
    >
      <div className="flex items-center gap-4">
        <span
          aria-hidden
          className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/12 text-primary"
        >
          <UserRound className="size-6" />
        </span>
        <div className="flex min-w-0 flex-col">
          <span className={eyebrow}>Trainer</span>
          <h2
            id="trainer-name"
            className="truncate font-display text-2xl font-extrabold tracking-tight sm:text-3xl"
          >
            {trainer.name}{' '}
            <span className="font-mono text-base font-bold text-primary">Lv {trainer.level}</span>
          </h2>
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
          <span data-testid="next-unlock" className="text-foreground">
            {next ?? 'Every unlock reached'}
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {xp} / {max} XP
          </span>
        </div>
        <div
          role="progressbar"
          aria-label={`Trainer XP to level ${trainer.level + 1}`}
          aria-valuenow={xp}
          aria-valuemin={0}
          aria-valuemax={max}
          className="h-2.5 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-primary"
            style={{ width: `${max > 0 ? (xp / max) * 100 : 0}%` }}
          />
        </div>
      </div>
    </section>
  );
}

const PULSE: Keyframe[] = [
  { transform: 'scale(1)' },
  { transform: 'scale(1.08)', offset: 0.35 },
  { transform: 'scale(0.99)', offset: 0.7 },
  { transform: 'scale(1)' },
];

/**
 * The next ladder stage: its rival (name, mini-sprites with level), the first-clear reward and
 * "Fight". Right after onboarding it reads "Stage 1 is ready", and `celebrate` pulses Fight once (not
 * under reduced motion) and focuses it. With every stage cleared it offers replays from the ladder.
 */
export function NextStageCard({
  ladder,
  celebrate,
}: {
  ladder: Save['ladder'];
  celebrate: boolean;
}) {
  const view = nextStageView({ ladder });
  const { stage } = view;
  const reduced = usePrefersReducedMotion();
  const fightRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const el = fightRef.current;
    if (!celebrate || !el) return;
    el.focus({ preventScroll: true });
    if (reduced || typeof el.animate !== 'function') return;
    const animation = el.animate(PULSE, { duration: DUR.xxl, easing: EASE.spring });
    return () => animation.cancel();
    // Once per mount: a later motion toggle must not replay it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebrate]);

  const title = view.complete
    ? 'Ladder complete'
    : ladder.cleared === 0
      ? `Stage ${stage} is ready`
      : `Stage ${stage}`;

  return (
    <section aria-labelledby="next-stage-title" className={cn(panel, 'overflow-hidden')}>
      <div className="flex flex-col gap-1">
        <span className={eyebrow}>Next stage</span>
        <h2
          id="next-stage-title"
          className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl"
        >
          {title}
        </h2>
      </div>
      {view.complete ? (
        <p className="text-sm text-muted-foreground">Replay any stage for XP and capsules.</p>
      ) : (
        <>
          <RivalLineup name={view.rivalName} rival={view.rival} />
          <p className="text-sm text-muted-foreground">
            First clear: <span className="font-semibold text-foreground">{view.firstClear}</span>
          </p>
        </>
      )}
      <div>
        {view.complete ? (
          <Link ref={fightRef} href="/ladder/" className={cn(primaryLink, 'px-8')}>
            <Swords aria-hidden className="size-5" />
            Replay a stage
          </Link>
        ) : (
          <DocumentLink
            ref={fightRef}
            href={`/battle/?stage=${stage}`}
            aria-label={`Fight · Stage ${stage}`}
            data-pulse={celebrate && !reduced ? '' : undefined}
            className={cn(primaryLink, 'px-8')}
          >
            <Swords aria-hidden className="size-5" />
            Fight
          </DocumentLink>
        )}
      </div>
    </section>
  );
}

/** "Rival Ada Moss" and the rival team's mini-sprites, lead first, each with its level. */
function RivalLineup({ name, rival }: { name: string; rival: RivalPreview[] }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-foreground" data-testid="next-stage-rival">
        Rival {name}
      </p>
      <ul aria-label={`Rival ${name}'s team`} className="flex flex-wrap gap-2">
        {rival.map((m) => (
          <li
            key={m.speciesId}
            className="flex items-center gap-1 rounded-2xl border border-white/10 bg-secondary/50 py-1 pr-3 pl-1"
          >
            <CreatureArt
              speciesId={m.speciesId}
              name={m.name}
              color={typeColor(getSpecies(m.speciesId)?.types[0])}
              kind="sprite"
              interactive={false}
              className="size-10 shrink-0 [image-rendering:pixelated]"
            />
            <span className="font-mono text-xs text-muted-foreground">
              <span className="sr-only">{m.name}, </span>Lv {m.level}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 1–4 holo cards, open empty slots and locked slots with their unlock level; "Edit team" opens the team dialog. */
export function TeamStrip({
  save,
  onEditTeam,
}: {
  save: Pick<Save, 'team' | 'collection' | 'trainer'>;
  onEditTeam: () => void;
}) {
  const slots = teamStrip(save);
  const members = slots.filter((s) => s.kind === 'member').length;
  const open = teamSlots(save.trainer.level);
  return (
    <section aria-labelledby="team-title" className={panel}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="team-title" className="font-display text-xl font-bold tracking-tight">
          Team{' '}
          <span className="font-mono text-sm font-bold text-muted-foreground">
            {members} / {open}
          </span>
        </h2>
        <button type="button" onClick={onEditTeam} className={outlineLink}>
          Edit team
        </button>
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {slots.map((slot) => (
          <li key={slot.slot} data-team-slot={slot.slot}>
            {slot.kind === 'member' ? (
              <HoloCard
                variant="mini"
                speciesId={slot.owned.speciesId}
                level={slot.owned.level}
                stars={slot.owned.stars}
                talentPoints={talentPointsAvailable(slot.owned)}
                href={`/creature/?id=${slot.owned.speciesId}`}
              />
            ) : slot.kind === 'empty' ? (
              <HoloCard variant="slot" slot={slot.slot} className="h-full" />
            ) : (
              <HoloCard
                variant="locked"
                slot={slot.slot}
                unlockLevel={slot.unlockLevel}
                className="h-full"
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "N / SPECIES_COUNT caught" → the collection. */
export function CollectionTile({ count }: { count: number }) {
  const percent = SPECIES_COUNT > 0 ? (count / SPECIES_COUNT) * 100 : 0;
  return (
    <Link
      href="/collection/"
      aria-label={`Collection, ${count} of ${SPECIES_COUNT} caught`}
      className="flex items-center gap-4 rounded-3xl p-5 glass transition-colors hover:bg-secondary/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <LayoutGrid aria-hidden className="size-6 shrink-0 text-rarity-rare" />
      <span className="flex min-w-0 flex-1 flex-col gap-2">
        <span className="flex items-baseline justify-between gap-3">
          <span className="font-display text-lg font-bold tracking-tight">Collection</span>
          <span className="font-mono text-sm text-muted-foreground">
            <span className="text-foreground">{count}</span> / {SPECIES_COUNT} caught
          </span>
        </span>
        <span aria-hidden className="block h-1.5 overflow-hidden rounded-full bg-muted">
          <span
            className="block h-full rounded-full bg-rarity-rare"
            style={{ width: `${percent}%` }}
          />
        </span>
      </span>
      <ChevronRight aria-hidden className="size-5 shrink-0 text-muted-foreground" />
    </Link>
  );
}
