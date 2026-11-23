'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Download, Sparkles, TriangleAlert, X } from 'lucide-react';
import type { PersistState } from '@/entities/save';
import { cn } from '@/shared/lib/cn';
import { dismiss, isDismissed } from '../model/session';
import { textLink } from './styles';

const SETTINGS_HREF = '/settings/';

type Props = {
  atRisk: boolean;
  persist: PersistState;
  backupDue: boolean;
  /** Collection size when this is a fresh v1 import (welcome line), else null. */
  v1Imported: number | null;
};

/**
 * The hub's notices (design.md screen `home`): storage at risk, persistent storage denied, backup due
 * and the one-time v1 welcome. Dismissals last for this page load only (no stored keys).
 */
export function HubBanners({ atRisk, persist, backupDue, v1Imported }: Props) {
  const [hidden, setHidden] = useState(() => ({
    persistDenied: isDismissed('persistDenied'),
    v1Welcome: isDismissed('v1Welcome'),
  }));

  const close = (key: 'persistDenied' | 'v1Welcome') => {
    dismiss(key);
    setHidden((h) => ({ ...h, [key]: true }));
  };

  const banners: ReactNode[] = [];
  if (v1Imported !== null && !hidden.v1Welcome) {
    banners.push(
      <Banner
        key="v1"
        id="v1-welcome"
        tone="info"
        icon={<Sparkles aria-hidden className="size-5 shrink-0 text-primary" />}
        onDismiss={() => close('v1Welcome')}
        dismissLabel="Dismiss welcome message"
      >
        Your v1 trainers were imported: {v1Imported} Pokémon added.
      </Banner>,
    );
  }
  if (atRisk) {
    banners.push(
      <Banner
        key="risk"
        id="storage-at-risk"
        tone="warn"
        icon={<TriangleAlert aria-hidden className="size-5 shrink-0 text-destructive" />}
        action={
          <Link href={SETTINGS_HREF} className={textLink}>
            Export save
          </Link>
        }
      >
        Progress isn’t being saved in this browser. Export your save to keep it.
      </Banner>,
    );
  }
  if (persist === 'denied' && !hidden.persistDenied) {
    banners.push(
      <Banner
        key="persist"
        id="persist-denied"
        tone="info"
        icon={<TriangleAlert aria-hidden className="size-5 shrink-0 text-primary" />}
        onDismiss={() => close('persistDenied')}
        dismissLabel="Dismiss storage notice"
      >
        Browser may clear data. Export often.
      </Banner>,
    );
  }
  // Storage at risk already asks for an export.
  if (backupDue && !atRisk) {
    banners.push(
      <Banner
        key="backup"
        id="backup-due"
        tone="info"
        icon={<Download aria-hidden className="size-5 shrink-0 text-primary" />}
        action={
          <Link href={SETTINGS_HREF} className={textLink}>
            Export save
          </Link>
        }
      >
        Back up your progress
      </Banner>,
    );
  }

  if (banners.length === 0) return null;
  return (
    <section aria-label="Notices" className="flex flex-col gap-3">
      {banners}
    </section>
  );
}

function Banner({
  id,
  tone,
  icon,
  action,
  onDismiss,
  dismissLabel,
  children,
}: {
  id: string;
  tone: 'info' | 'warn';
  icon: ReactNode;
  action?: ReactNode;
  onDismiss?: () => void;
  dismissLabel?: string;
  children: ReactNode;
}) {
  return (
    <div
      role="status"
      data-banner={id}
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border px-4 py-3',
        tone === 'warn'
          ? 'border-destructive/50 bg-destructive/10'
          : 'border-primary/30 bg-primary/8',
      )}
    >
      {icon}
      <p className="min-w-0 flex-1 text-sm text-foreground">{children}</p>
      {action}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={dismissLabel}
          className="tap-target grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <X aria-hidden className="size-4" />
        </button>
      )}
    </div>
  );
}
