'use client';

import { useId } from 'react';
import { Lock } from 'lucide-react';
import {
  RARITY_LABEL,
  RARITY_TEXT_CLASS,
  TIER_LABEL,
  pityStatus,
  rarityColor,
  tierLockReason,
} from '@/entities/capsule';
import { useSave } from '@/entities/save';
import {
  CAPSULE_TIERS,
  economy,
  RARITIES,
  type CapsuleTier,
  type Rarity,
} from '@/shared/config/economy';
import { cn } from '@/shared/lib/cn';
import { pityText } from '../model/reveal';

/** "0.2%", "60%" */
export const formatPercent = (value: number) => `${Number(value.toFixed(2))}%`;

type PityMeterProps = {
  tier: CapsuleTier;
  rarity: Rarity;
  opens: number;
  /** Opens since the pity rarity last dropped. */
  count: number;
  /** Visible + spoken value, e.g. "Rare guaranteed within 9 opens". */
  text: string;
  /** Panel surface: 'muted' on page panels, 'card' inside the dialog (which is muted itself). */
  surface?: 'muted' | 'card';
  className?: string;
};

/** One tier's pity: a text line and a `role="progressbar"` meter of opens since the last drop. */
export function PityMeter({
  tier,
  rarity,
  opens,
  count,
  text,
  surface = 'muted',
  className,
}: PityMeterProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-2xl px-4 py-3.5',
        surface === 'card' ? 'bg-card' : 'bg-muted',
        className,
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-foreground">
          <span className="text-muted-foreground">{TIER_LABEL[tier]} · </span>
          {text}
        </span>
        <span aria-hidden className="shrink-0 font-mono text-xs text-muted-foreground">
          {count} / {opens}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`${TIER_LABEL[tier]} capsule pity`}
        aria-valuemin={0}
        aria-valuemax={opens}
        aria-valuenow={count}
        aria-valuetext={text}
        className="h-2 overflow-hidden rounded-full bg-secondary"
      >
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${(count / opens) * 100}%`, background: rarityColor(rarity) }}
        />
      </div>
    </div>
  );
}

/** Odds per tier as a real table: one row per rarity, one column per tier. */
export function OddsTable({ className }: { className?: string }) {
  return (
    <table className={cn('w-full border-collapse text-sm', className)}>
      <caption className="sr-only">Drop odds per capsule tier</caption>
      <thead>
        <tr className="border-b border-border text-left">
          <th scope="col" className="py-2 pr-3 font-semibold text-muted-foreground">
            Rarity
          </th>
          {CAPSULE_TIERS.map((tier) => (
            <th
              key={tier}
              scope="col"
              className="py-2 pl-3 text-right font-semibold text-muted-foreground"
            >
              {TIER_LABEL[tier]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {RARITIES.map((rarity) => (
          <tr key={rarity} className="border-b border-border/50 last:border-0">
            <th scope="row" className="py-2 pr-3 text-left font-semibold">
              <span className={cn('inline-flex items-center gap-2', RARITY_TEXT_CLASS[rarity])}>
                <span
                  aria-hidden
                  className="size-2.5 rounded-full"
                  style={{ background: rarityColor(rarity) }}
                />
                {RARITY_LABEL[rarity]}
              </span>
            </th>
            {CAPSULE_TIERS.map((tier) => (
              <td key={tier} className="py-2 pl-3 text-right font-mono text-foreground">
                {formatPercent(economy.capsules.odds[tier][rarity])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

type OddsPityProps = {
  className?: string;
  /** Heading text (an h2). */
  title?: string;
};

/**
 * Honest odds and pity for every tier, read from the save: the odds table (always visible), a pity
 * meter per unlocked tier and the unlock reason for a locked one. Reused by Capsules and Home.
 */
export function OddsPity({ className, title = 'Odds & pity' }: OddsPityProps) {
  const headingId = useId();
  const pity = useSave((s) => s.pity);
  const level = useSave((s) => s.trainer.level);
  const opened = useSave((s) => s.capsulesOpened);

  return (
    <section
      aria-labelledby={headingId}
      className={cn('flex flex-col gap-5 rounded-3xl p-5 glass sm:p-6', className)}
    >
      <div className="flex flex-col gap-1">
        <h2 id={headingId} className="font-display text-xl font-bold tracking-tight">
          {title}
        </h2>
        <p className="text-sm text-muted-foreground">
          Every capsule rolls from these odds. Pity guarantees a rarity after a dry streak.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <OddsTable />
        <div className="flex flex-col gap-3">
          {CAPSULE_TIERS.map((tier) => {
            if (pity === undefined || level === undefined) {
              return (
                <div
                  key={tier}
                  aria-hidden
                  className="shimmer relative h-[74px] overflow-hidden rounded-2xl bg-muted"
                />
              );
            }
            const reason = tierLockReason({ trainer: { level } }, tier);
            if (reason) {
              return (
                <p
                  key={tier}
                  className="flex items-center gap-3 rounded-2xl bg-muted px-4 py-3.5 text-sm text-muted-foreground"
                >
                  <Lock aria-hidden className="size-4 shrink-0" />
                  {reason}
                </p>
              );
            }
            const status = pityStatus({ pity }, tier);
            return (
              <PityMeter
                key={tier}
                tier={tier}
                rarity={status.rarity}
                opens={status.opens}
                count={status.count}
                text={pityText(status.rarity, status.left)}
              />
            );
          })}
          {opened === 0 && (
            <p className="text-xs text-muted-foreground">
              First capsule · {RARITY_LABEL[economy.capsules.firstCapsuleMinRarity]} or better
              guaranteed
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
