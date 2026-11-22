import Link from 'next/link';
import { Lock } from 'lucide-react';
import { CapsuleArt, TIER_LABEL, tierLockReason } from '@/entities/capsule';
import { CAPSULE_TIERS, economy, type CapsuleTier } from '@/shared/config/economy';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/Button';

/** Primary-button look for links (next/link can't use the Button component). */
export const linkButtonClass =
  'inline-flex h-12 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary px-5 text-[15px] font-semibold text-primary-foreground shadow-glow transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

type StacksProps = {
  capsules: Record<CapsuleTier, number>;
  trainerLevel: number;
  onOpen: (tier: CapsuleTier, all: boolean) => void;
};

/** One stack per tier with its count; "Open" (and "Open all" at 2+), or the unlock reason. */
export function TierStacks({ capsules, trainerLevel, onOpen }: StacksProps) {
  return (
    <ul aria-label="Your capsules" className="grid gap-4 sm:grid-cols-2">
      {CAPSULE_TIERS.map((tier) => {
        const count = capsules[tier];
        const reason = tierLockReason({ trainer: { level: trainerLevel } }, tier);
        const label = TIER_LABEL[tier];
        return (
          <li
            key={tier}
            data-tier={tier}
            className={cn(
              'flex flex-col gap-4 rounded-3xl p-5 glass sm:flex-row sm:items-center',
              reason && 'opacity-80',
            )}
          >
            <div className="flex flex-1 items-center gap-4">
              <CapsuleStack tier={tier} count={count} locked={reason !== null} />
              <div className="flex min-w-0 flex-col gap-1">
                <h3 className="font-display text-xl font-bold tracking-tight">{label} capsule</h3>
                <p className="font-mono text-sm text-muted-foreground">
                  <span className="text-foreground">{count}</span> unopened
                </p>
                {reason && (
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Lock aria-hidden className="size-4 shrink-0" />
                    {reason}
                  </p>
                )}
              </div>
            </div>
            {!reason && count > 0 && (
              <div className="flex flex-wrap gap-2 sm:flex-col">
                {count >= 2 && (
                  <Button
                    size="lg"
                    onClick={() => onOpen(tier, true)}
                    aria-label={`Open all ${count} ${label} capsules`}
                    className="cursor-pointer justify-center"
                  >
                    Open all
                  </Button>
                )}
                <Button
                  size="lg"
                  variant={count >= 2 ? 'outline' : 'primary'}
                  onClick={() => onOpen(tier, false)}
                  aria-label={`Open 1 ${label} capsule`}
                  className="cursor-pointer justify-center"
                >
                  Open
                </Button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** The capsule art, with up to two offset copies behind it when there are several. */
function CapsuleStack({
  tier,
  count,
  locked,
}: {
  tier: CapsuleTier;
  count: number;
  locked: boolean;
}) {
  const behind = Math.min(2, Math.max(0, count - 1));
  return (
    <div aria-hidden className="relative h-24 w-20 shrink-0">
      {Array.from({ length: behind }, (_, i) => (
        <CapsuleArt
          key={i}
          tier={tier}
          className="absolute inset-0 size-full opacity-40"
          style={{ translate: `${(behind - i) * 6}px ${(i - behind) * 4}px` }}
        />
      ))}
      <CapsuleArt
        tier={tier}
        className={cn('absolute inset-0 size-full', (locked || count === 0) && 'grayscale')}
      />
    </div>
  );
}

/** "No capsules…" + Fight, linking to the next ladder stage. */
export function EmptyCapsules({ cleared }: { cleared: number }) {
  const stage = Math.min(cleared + 1, economy.battle.ladderStages);
  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl px-6 py-10 text-center glass">
      <CapsuleArt tier="basic" className="w-16 opacity-60 grayscale" />
      <p className="max-w-sm text-foreground">
        No capsules. Win battles and finish daily quests to earn them.
      </p>
      <Link href={`/battle/?stage=${stage}`} className={linkButtonClass}>
        Fight
      </Link>
    </div>
  );
}
