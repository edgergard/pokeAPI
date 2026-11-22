'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import {
  CapsuleArt,
  RARITY_LABEL,
  RARITY_TEXT_CLASS,
  TIER_LABEL,
  rarityColor,
  type RevealResult,
} from '@/entities/capsule';
import { cn } from '@/shared/lib/cn';
import { DUR, EASE, usePrefersReducedMotion } from '@/shared/lib/motion';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import {
  DONE_STAGE,
  FIRST_STAGE,
  cardAnnouncement,
  cardHeadline,
  firstCapsuleNote,
  nextStage,
  pityAfterReveal,
  pityFooterText,
  revealOrder,
  revealTotals,
  stageDuration,
  summaryAnnouncement,
  type RevealPhase,
  type RevealStage,
} from '../model/reveal';
import { PityMeter } from './OddsPity';
import { RevealBurst, play } from './RevealBurst';
import { MiniCard, RevealCard } from './RevealCard';

export type RevealPrimaryLabel = 'Add to team' | 'View new' | 'Done';

type Props = {
  /** Already rolled and saved (roll order). The dialog only animates them. */
  results: readonly RevealResult[];
  open: boolean;
  /** Close after the reveal. Esc / Skip during the animation only skip to the result. */
  onClose: () => void;
  /** 'Add to team' (first Pokémon ever) / 'View new' / 'Done'. */
  primaryLabel: RevealPrimaryLabel;
  onPrimary: () => void;
  /** Secondary "Open next" once the reveal is done (omit when there is nothing left to open). */
  onOpenNext?: () => void;
  title?: string;
};

const SHAKE: Keyframe[] = [
  { transform: 'rotate(0deg) scale(1)' },
  { transform: 'rotate(-8deg) scale(1.02)', offset: 0.14 },
  { transform: 'rotate(7deg) scale(1.03)', offset: 0.28 },
  { transform: 'rotate(-6deg) scale(1.04)', offset: 0.42 },
  { transform: 'rotate(5deg) scale(1.05)', offset: 0.56 },
  { transform: 'rotate(-4deg) scale(1.07)', offset: 0.7 },
  { transform: 'rotate(2deg) scale(1.08)', offset: 0.85 },
  { transform: 'rotate(0deg) scale(1.1)' },
];

/**
 * The capsule-opening ritual (design.md `capsule-reveal`): per card shake → rarity flash → flip to a holo
 * card, the rarest last; then the result (single) or a summary grid (multi) with the pity footer.
 * Results are committed before this opens, so Skip / Esc only skip the animation, never the result.
 */
export function CapsuleReveal({
  results,
  open,
  onClose,
  primaryLabel,
  onPrimary,
  onOpenNext,
  title = 'Capsule',
}: Props) {
  const reduced = usePrefersReducedMotion();
  const order = useMemo(() => revealOrder(results), [results]);
  const count = order.length;
  const startStage = count > 0 ? FIRST_STAGE : DONE_STAGE;

  const [stage, setStage] = useState<RevealStage>(startStage);
  /** Bumped on every restart: the stage remounts face-down instead of flipping back over the new card. */
  const [run, setRun] = useState(0);
  // New results (e.g. "Open next") or a reopen restart the ritual — derived during render, not in an effect.
  const [shown, setShown] = useState({ results, open });
  if (shown.results !== results || shown.open !== open) {
    if (open && (shown.results !== results || !shown.open)) {
      setStage(startStage);
      setRun((r) => r + 1);
    }
    setShown({ results, open });
  }

  const animating = open && stage.step === 'reveal';

  useEffect(() => {
    if (!open || stage.step === 'done') return;
    const timer = setTimeout(
      () => setStage((s) => nextStage(s, count, reduced)),
      stageDuration(stage, count, reduced),
    );
    return () => clearTimeout(timer);
  }, [open, stage, count, reduced]);

  // Keep keyboard focus on the action that exists: Skip while animating, then the primary action.
  const skipRef = useRef<HTMLButtonElement>(null);
  const primaryRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    (animating ? skipRef : primaryRef).current?.focus({ preventScroll: true });
  }, [open, animating]);

  const skip = () => setStage(DONE_STAGE);
  // Dialog maps Esc, the close button and the backdrop to onClose: mid-animation they skip instead.
  const handleClose = () => (animating ? skip() : onClose());

  const single = count === 1;
  const done = stage.step === 'done';
  const index = stage.step === 'reveal' ? stage.index : count - 1;
  const phase: RevealPhase = stage.step === 'reveal' ? stage.phase : 'card';
  const focus = order[index];

  let spoken = '';
  if (done) {
    spoken = single && order[0] ? cardAnnouncement(order[0]) : summaryAnnouncement(order);
  } else {
    const last = order[phase === 'card' ? index : index - 1];
    if (last) spoken = cardAnnouncement(last);
  }

  const footer = animating ? (
    <Button
      ref={skipRef}
      variant="outline"
      size="lg"
      onClick={skip}
      aria-keyshortcuts="Escape"
      className="cursor-pointer justify-center"
    >
      Skip
      <kbd className="rounded-md border border-input px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
        Esc
      </kbd>
    </Button>
  ) : (
    <>
      {onOpenNext && (
        <Button
          variant="outline"
          size="lg"
          onClick={onOpenNext}
          className="cursor-pointer justify-center"
        >
          Open next
        </Button>
      )}
      <Button
        ref={primaryRef}
        size="lg"
        onClick={onPrimary}
        className="cursor-pointer justify-center"
      >
        {primaryLabel}
      </Button>
    </>
  );

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title={title}
      footer={footer}
      className="sm:w-[min(860px,calc(100vw-2rem))]"
    >
      <div
        data-reveal-phase={done ? 'done' : phase}
        data-reveal-index={index}
        // Bleeds to the dialog edges so glows fade out there instead of being cut at the padding.
        className="-mx-6 flex flex-col gap-6 overflow-x-clip px-6"
      >
        {done && !single ? (
          <RevealSummary order={order} />
        ) : (
          focus && (
            <div className="flex flex-col items-center gap-6 py-4 sm:flex-row sm:gap-10 sm:pl-4">
              <RevealStageView
                key={`${run}-${index}`}
                result={focus}
                phase={phase}
                reduced={reduced}
              />
              <RevealPanel result={focus} revealed={phase === 'card'} index={index} count={count} />
            </div>
          )
        )}
        {done && <RevealFooter results={results} />}
        <p role="status" className="sr-only">
          {spoken}
        </p>
      </div>
    </Dialog>
  );
}

function RevealStageView({
  result,
  phase,
  reduced,
}: {
  result: RevealResult;
  phase: RevealPhase;
  reduced: boolean;
}) {
  const capsuleRef = useRef<HTMLDivElement>(null);
  const faceRef = useRef<HTMLDivElement>(null);
  const flipped = phase === 'card';
  const tier = result.kind === 'capsule' ? result.tier : 'basic';
  const color = rarityColor(result.rarity);

  // Capsule: shake while charging, swell during the flash; reduced motion just fades it in.
  useEffect(() => {
    const el = capsuleRef.current;
    if (phase === 'charge') {
      if (reduced)
        play(el, [{ opacity: 0 }, { opacity: 1 }], { duration: DUR.md, easing: EASE.standard });
      else play(el, SHAKE, { duration: DUR.xl + DUR.sm, easing: 'ease-in-out', fill: 'forwards' });
    } else if (phase === 'flash' && !reduced) {
      play(el, [{ transform: 'scale(1.1)' }, { transform: 'scale(1.25)', opacity: 0.5 }], {
        duration: DUR.md,
        easing: EASE.outExpo,
        fill: 'forwards',
      });
    }
  }, [phase, reduced]);

  // Reduced motion: the flip is instant, so crossfade the card in instead.
  useEffect(() => {
    if (!flipped || !reduced) return;
    play(faceRef.current, [{ opacity: 0 }, { opacity: 1 }], {
      duration: DUR.md,
      easing: EASE.standard,
    });
  }, [flipped, reduced]);

  return (
    <div className="relative grid w-full max-w-[260px] shrink-0 place-items-center perspective-[1200px]">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-8 rounded-full transition-opacity duration-500"
        style={{
          background: `radial-gradient(circle, color-mix(in oklab, ${color} 50%, transparent), color-mix(in oklab, ${color} 12%, transparent) 45%, transparent 70%)`,
          opacity: phase === 'charge' ? 0 : 1,
        }}
      />
      <div
        data-flipper
        className={cn(
          'relative w-full transform-3d',
          // Only the turn face-up animates; while charging the card must already sit face-down.
          !reduced &&
            phase !== 'charge' &&
            'transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
        )}
        style={{ transform: flipped ? 'rotateY(0deg)' : 'rotateY(180deg)' }}
      >
        <div ref={faceRef} aria-hidden={!flipped} inert={!flipped} className="backface-hidden">
          <RevealCard result={result} />
        </div>
        <div
          aria-hidden
          className="absolute inset-0 grid rotate-y-180 place-items-center backface-hidden"
        >
          <div ref={capsuleRef}>
            <CapsuleArt
              tier={tier}
              coreColor={phase === 'flash' ? color : undefined}
              className="w-36 drop-shadow-[0_18px_30px_rgb(0_0_0/0.55)]"
            />
          </div>
        </div>
      </div>
      {phase === 'flash' && !reduced && <RevealBurst color={color} />}
    </div>
  );
}

function RevealPanel({
  result,
  revealed,
  index,
  count,
}: {
  result: RevealResult;
  revealed: boolean;
  index: number;
  count: number;
}) {
  const source = result.kind === 'capsule' ? `${TIER_LABEL[result.tier]} capsule` : 'Crafted';
  const progress = count > 1 ? ` · ${index + 1} of ${count}` : '';
  return (
    <div className="flex w-full min-w-0 flex-1 flex-col gap-2 text-center sm:text-left">
      <span className="font-mono text-xs tracking-[0.18em] text-muted-foreground uppercase">
        {source}
        {progress}
        {revealed && (
          <>
            {' · '}
            <span className={RARITY_TEXT_CLASS[result.rarity]}>{RARITY_LABEL[result.rarity]}</span>
          </>
        )}
      </span>
      <p className="font-display text-3xl leading-[1.05] font-extrabold tracking-tight text-balance text-foreground sm:text-4xl">
        {revealed ? cardHeadline(result) : 'Opening…'}
      </p>
    </div>
  );
}

function RevealSummary({ order }: { order: readonly RevealResult[] }) {
  const totals = revealTotals(order);
  const parts = [
    totals.fresh > 0 && `${totals.fresh} new`,
    totals.starUps > 0 && `${totals.starUps} ★ up`,
    totals.dust > 0 && `+${totals.dust} dust`,
  ].filter(Boolean);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="font-display text-3xl font-extrabold tracking-tight">
          {totals.cards} capsules opened
        </p>
        {parts.length > 0 && <p className="text-sm text-muted-foreground">{parts.join(' · ')}</p>}
      </div>
      <ul
        aria-label="Capsule results"
        className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-5"
      >
        {order.map((result, i) => (
          <li key={i} className="row-in" style={{ '--i': i } as CSSProperties}>
            <MiniCard result={result} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function RevealFooter({ results }: { results: readonly RevealResult[] }) {
  const pities = pityAfterReveal(results);
  const note = firstCapsuleNote(results);
  if (pities.length === 0 && !note) return null;
  return (
    <div className="flex flex-col gap-2">
      {pities.map((pity) => (
        <PityMeter
          key={pity.tier}
          tier={pity.tier}
          rarity={pity.rarity}
          opens={pity.opens}
          count={pity.count}
          text={pityFooterText(pity)}
          surface="card"
        />
      ))}
      {note && <p className="text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
