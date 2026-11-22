'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lock } from 'lucide-react';
import {
  CapsuleArt,
  TIER_LABEL,
  isTierUnlocked,
  pityStatus,
  tierLockReason,
  type RevealResult,
} from '@/entities/capsule';
import type { Save } from '@/entities/save';
import { useOpenCapsule } from '@/features/open-capsule';
import { CAPSULE_TIERS, type CapsuleTier } from '@/shared/config/economy';
import { Button } from '@/shared/ui/Button';
import { CapsuleReveal, PityMeter, pityText } from '@/widgets/capsule-reveal';
import { outlineLink, panel } from './styles';

/** After the dialog's exit (300 ms fallback), so the native focus restore has already happened. */
const FOCUS_AFTER_CLOSE_MS = 350;

type Reveal = { results: RevealResult[]; tier: CapsuleTier };

/**
 * Unopened capsules per tier with "Open" (→ CapsuleReveal), dust and the pity meters of unlocked
 * tiers. Every open is committed by `useOpenCapsule` before the reveal animates.
 */
export function CapsuleTray({
  save,
}: {
  save: Pick<Save, 'capsules' | 'pity' | 'dust' | 'trainer'>;
}) {
  const { openOne } = useOpenCapsule();
  const router = useRouter();
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [revealOpen, setRevealOpen] = useState(false);
  const [failedTier, setFailedTier] = useState<CapsuleTier | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(focusTimer.current), []);

  const total = CAPSULE_TIERS.reduce((sum, tier) => sum + save.capsules[tier], 0);
  const stacked = CAPSULE_TIERS.filter((tier) => save.capsules[tier] > 0);
  const pityTiers = CAPSULE_TIERS.filter((tier) => isTierUnlocked(save, tier));

  const open = (tier: CapsuleTier) => {
    const out = openOne(tier);
    if (!out.ok) {
      setFailedTier(tier);
      return;
    }
    setFailedTier(null);
    setReveal({ results: out.results, tier });
    setRevealOpen(true);
  };

  const close = () => {
    setRevealOpen(false);
    // The Open button may be gone (last capsule opened): land on the tray heading instead of <body>.
    clearTimeout(focusTimer.current);
    focusTimer.current = setTimeout(() => {
      const active = document.activeElement;
      if (active && active !== document.body && document.contains(active)) return;
      headingRef.current?.focus({ preventScroll: true });
    }, FOCUS_AFTER_CLOSE_MS);
  };

  const firstNew = reveal?.results.find((r) => r.outcome === 'new');
  const nextTier = reveal?.tier;
  const canOpenNext =
    nextTier !== undefined && save.capsules[nextTier] > 0 && isTierUnlocked(save, nextTier);

  return (
    <section aria-labelledby="capsules-title" className={panel}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2
          id="capsules-title"
          ref={headingRef}
          tabIndex={-1}
          className="font-display text-xl font-bold tracking-tight outline-none"
        >
          Capsules
        </h2>
        <p className="font-mono text-sm text-muted-foreground">
          <span className="text-foreground">{total}</span> unopened ·{' '}
          <span className="text-foreground">{save.dust}</span> dust
        </p>
      </div>

      {total === 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            No capsules yet. Win battles to earn more.
          </p>
          <Link href="/capsules/" className={outlineLink}>
            Open capsules
          </Link>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {stacked.map((tier) => {
            const count = save.capsules[tier];
            const reason = tierLockReason(save, tier);
            const label = TIER_LABEL[tier];
            return (
              <li key={tier} data-tier={tier} className="flex items-center gap-4">
                <CapsuleArt tier={tier} className="h-14 w-12 shrink-0" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="font-semibold text-foreground">{label} capsule</span>
                  <span className="font-mono text-sm text-muted-foreground">×{count}</span>
                  {reason && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Lock aria-hidden className="size-3.5" />
                      {reason}
                    </span>
                  )}
                </div>
                {!reason && (
                  <Button
                    onClick={() => open(tier)}
                    aria-label={`Open 1 ${label} capsule`}
                    className="cursor-pointer"
                  >
                    Open
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {failedTier && (
        <p role="alert" className="flex flex-wrap items-center gap-2 text-sm text-foreground">
          Couldn’t open.
          <button
            type="button"
            onClick={() => open(failedTier)}
            className="tap-target cursor-pointer font-semibold text-destructive underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Try again
          </button>
        </p>
      )}

      {pityTiers.map((tier) => {
        const pity = pityStatus(save, tier);
        return (
          <PityMeter
            key={tier}
            tier={tier}
            rarity={pity.rarity}
            opens={pity.opens}
            count={pity.count}
            text={pityText(pity.rarity, pity.left)}
          />
        );
      })}

      {reveal && (
        <CapsuleReveal
          results={reveal.results}
          open={revealOpen}
          onClose={close}
          primaryLabel={firstNew ? 'View new' : 'Done'}
          onPrimary={() => {
            if (firstNew) router.push(`/creature/?id=${firstNew.speciesId}`);
            close();
          }}
          onOpenNext={canOpenNext && nextTier ? () => open(nextTier) : undefined}
        />
      )}
    </section>
  );
}
