import { useEffect, useId, useRef } from 'react';
import { Package, Trophy } from 'lucide-react';
import { getSpecies, typeColor } from '@/entities/pokemon';
import { xpToNextTrainerLevel } from '@/entities/progression';
import { useSave } from '@/entities/save';
import { economy } from '@/shared/config/economy';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';
import { CreatureArt } from '@/widgets/capsule-reveal';
import { trainerLabel } from '../model/suggestion';
import { XpBar } from './XpBar';

type Props = {
  /** Inside the arena (absolute overlay) or on its own after a reload. */
  variant: 'overlay' | 'panel';
  /** `capsule`: the first Pokémon is in the collection, waiting for "Add to team". */
  step: 'fought' | 'capsule';
  /** Capsules the intro granted (from the battle summary, or the intro reward after a reload). */
  capsules: number;
  /** The first Pokémon (step `capsule`). */
  newSpeciesId: number | null;
  openError: boolean;
  onOpenCapsule: () => void;
  onAddToTeam: (speciesId: number) => void;
};

/**
 * The onboarding result (design.md flow `first-visit` steps 4–5): "Victory", the trainer bar,
 * "+1 Capsule" → "Open capsule"; once the capsule is opened, the new Pokémon with "Add to team".
 * Focus lands on the primary button.
 */
export function IntroResult({
  variant,
  step,
  capsules,
  newSpeciesId,
  openError,
  onOpenCapsule,
  onAddToTeam,
}: Props) {
  const headingId = useId();
  const primaryRef = useRef<HTMLButtonElement>(null);
  const trainer = useSave((s) => s.trainer);
  const loanerId = useSave((s) => s.onboarding.loanerSpeciesId);
  const loaner = loanerId === null || loanerId === undefined ? undefined : getSpecies(loanerId);
  const fresh = newSpeciesId === null ? undefined : getSpecies(newSpeciesId);

  // Focus without scrolling, so "Victory" and the reward at the top of the overlay stay in view.
  useEffect(() => {
    primaryRef.current?.focus({ preventScroll: true });
  }, []);

  const need = trainer ? xpToNextTrainerLevel(trainer.level) : 0;
  const adding = step === 'capsule' && fresh;

  return (
    <section
      aria-labelledby={headingId}
      data-outcome="won"
      data-step={step}
      className={cn(
        variant === 'overlay'
          ? 'absolute inset-0 z-10 flex animate-[fade-in_400ms_var(--ease-standard)_backwards] overflow-y-auto bg-linear-to-t from-background/95 via-background/75 to-background/40 p-3 sm:p-6'
          : 'flex',
      )}
    >
      <div className="m-auto flex w-full max-w-md animate-[rise_600ms_var(--ease-out-expo)_120ms_backwards] flex-col gap-4 rounded-3xl border border-white/12 bg-card/95 p-4 shadow-2xl sm:p-6">
        <header>
          <p className="flex items-center gap-2 font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">
            <Trophy className="size-3.5 text-primary" aria-hidden />
            First battle · Cleared
          </p>
          <h2
            id={headingId}
            className="mt-1 font-display text-3xl font-extrabold tracking-tight text-primary sm:text-4xl"
          >
            Victory
          </h2>
        </header>

        {trainer && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-semibold">
                {trainerLabel(trainer.name)} · Lv {trainer.level}
              </span>
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {trainer.xp} / {need} XP
              </span>
            </div>
            <XpBar
              tone="trainer"
              label={`Trainer level ${trainer.level} XP`}
              value={trainer.xp}
              max={need}
            />
          </div>
        )}

        <ul aria-label="Loot" className="flex flex-wrap gap-2 text-sm">
          <li className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-secondary px-3 py-1 font-semibold">
            <Package className="size-4 text-primary" aria-hidden />+{capsules} Capsule
            {capsules === 1 ? '' : 's'}
          </li>
        </ul>

        {loaner && (
          <p className="text-sm text-muted-foreground">
            {loaner.name} · Loaner · Lv {economy.onboarding.loanerLevel}
          </p>
        )}

        {adding && (
          <div className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/5 p-3">
            <CreatureArt
              speciesId={fresh.id}
              name={fresh.name}
              color={typeColor(fresh.types[0])}
              className="size-20 shrink-0"
            />
            <p className="text-sm font-semibold">New! {fresh.name} joined your collection.</p>
          </div>
        )}

        {openError && (
          <p role="alert" className="text-sm text-destructive">
            Couldn&apos;t open. Try again
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {adding ? (
            <Button
              ref={primaryRef}
              onClick={() => onAddToTeam(fresh.id)}
              size="lg"
              className="cursor-pointer"
            >
              Add to team
            </Button>
          ) : (
            <Button ref={primaryRef} onClick={onOpenCapsule} size="lg" className="cursor-pointer">
              <Package className="size-4" aria-hidden />
              Open capsule
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}
