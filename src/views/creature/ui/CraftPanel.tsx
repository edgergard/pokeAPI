import { useId } from 'react';
import { Sparkles } from 'lucide-react';
import {
  RARITY_LABEL,
  RARITY_TEXT_CLASS,
  TIER_LABEL,
  craftPrice,
  dustMissing,
} from '@/entities/capsule';
import type { Species } from '@/entities/pokemon';
import { CAPSULE_TIERS, economy } from '@/shared/config/economy';
import { cn } from '@/shared/lib/cn';
import { formatPercent } from '@/widgets/capsule-reveal';

/**
 * A species the player doesn't own: rarity odds per capsule tier and "Craft for N dust", or the
 * focusable `aria-disabled` button with "Need N more dust" when the balance is short.
 */
export function CraftPanel({
  species,
  dust,
  onCraft,
  failed,
}: {
  species: Species;
  dust: number;
  onCraft: () => void;
  /** The last craft attempt failed: show "Couldn't craft. Try again". */
  failed: boolean;
}) {
  const headingId = useId();
  const reasonId = useId();
  const price = craftPrice(species.rarity);
  const missing = dustMissing({ dust }, price);
  const affordable = missing === 0;
  const rarity = RARITY_LABEL[species.rarity];

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-4 rounded-3xl p-4 glass sm:p-5"
    >
      <div className="flex flex-col gap-1">
        <h2 id={headingId} className="font-display text-xl font-bold tracking-tight">
          Not in your collection
        </h2>
        <p className="text-sm text-muted-foreground">
          Find it in a capsule, or craft it with dust right away.
        </p>
      </div>

      <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-[auto_1fr]">
        <dt className="text-muted-foreground">Rarity</dt>
        <dd className={cn('font-semibold', RARITY_TEXT_CLASS[species.rarity])}>{rarity}</dd>
        {CAPSULE_TIERS.map((tier) => (
          <div key={tier} className="contents">
            <dt className="text-muted-foreground">{TIER_LABEL[tier]} capsule</dt>
            <dd className="text-foreground">
              {formatPercent(economy.capsules.odds[tier][species.rarity])} chance of a {rarity}{' '}
              Pokémon
            </dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => {
            if (affordable) onCraft();
          }}
          aria-disabled={!affordable || undefined}
          aria-describedby={affordable ? undefined : reasonId}
          className={cn(
            'inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl px-5 text-base font-semibold transition-colors',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
            affordable
              ? 'cursor-pointer bg-primary text-primary-foreground shadow-glow hover:bg-primary-hover'
              : 'cursor-not-allowed border border-border bg-secondary text-muted-foreground',
          )}
        >
          <Sparkles aria-hidden className="size-4" />
          Craft for {price} dust
        </button>
        <p className="font-mono text-sm text-muted-foreground">
          <span className="sr-only">Dust balance: </span>
          {dust} dust
        </p>
      </div>
      {!affordable && (
        <p id={reasonId} className="-mt-2 text-sm text-foreground">
          Need {missing} more dust
        </p>
      )}
      {failed && (
        <p
          role="alert"
          className="rounded-2xl border border-destructive/50 bg-destructive/10 px-4 py-3 text-foreground"
        >
          Couldn&apos;t craft. Try again
        </p>
      )}
    </section>
  );
}
