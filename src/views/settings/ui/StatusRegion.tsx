import Link from 'next/link';
import { CircleAlert, CircleCheck, LoaderCircle } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { href } from '@/shared/lib/router';
import type { Notice } from '../model/notice';

const tones = {
  success: { box: 'border-rarity-uncommon/40 bg-rarity-uncommon/10', icon: CircleCheck },
  error: { box: 'border-destructive/50 bg-destructive/10', icon: CircleAlert },
  info: { box: 'border-white/10 bg-card', icon: LoaderCircle },
} as const;

const iconColor = {
  success: 'text-rarity-uncommon',
  error: 'text-destructive',
  info: 'text-primary motion-safe:animate-spin',
} as const;

/**
 * The page's single live region: every result (export, import, restore, reset, errors) lands here.
 * The region itself is always in the DOM so screen readers pick up each new message.
 */
export function StatusRegion({ notice }: { notice: Notice | null }) {
  const tone = notice ? tones[notice.tone] : null;
  const Icon = tone?.icon;
  return (
    <div
      data-tone={notice?.tone}
      className={cn(
        'flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl',
        tone && cn('mt-5 border px-4 py-3', tone.box),
      )}
    >
      <div role="status" aria-live="polite" aria-atomic="true" className="min-w-0">
        {notice && Icon && (
          <p key={notice.id} className="hint-in flex items-start gap-2.5 text-sm font-medium">
            <Icon aria-hidden className={cn('mt-0.5 size-4 shrink-0', iconColor[notice.tone])} />
            <span>{notice.text}</span>
          </p>
        )}
      </div>
      {notice?.homeLink && (
        <Link
          href={href('/')}
          className="tap-target rounded-lg text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Go to Home →
        </Link>
      )}
    </div>
  );
}
