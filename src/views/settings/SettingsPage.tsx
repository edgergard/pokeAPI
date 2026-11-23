'use client';

import { useCallback, useRef, useState } from 'react';
import { LOAD_ERROR_NEWER, useSaveConflict, useSaveStatus } from '@/entities/save';
import { TRANSFER_COPY } from '@/features/save-transfer';
import { MotionToggle } from '@/features/motion-toggle/MotionToggle';
import { useHydrated } from '@/shared/lib/useHydrated';
import { SETTINGS_COPY, type Announce, type Notice, type SaveLock } from './model/notice';
import { useBackupInfo } from './model/useBackupInfo';
import { AboutSection } from './ui/AboutSection';
import { Panel } from './ui/Panel';
import { ResetSection } from './ui/ResetSection';
import { SaveSection } from './ui/SaveSection';
import { StatusRegion } from './ui/StatusRegion';

/**
 * Settings & Save (design.md screen `settings`, flow `save-transfer`): storage status, export, import,
 * backup restore, motion, reset and about. Save-dependent parts wait for hydration and the save load,
 * so the prerendered HTML never shows a wrong guess.
 */
export function SettingsPage() {
  const hydrated = useHydrated();
  const { status, error, atRisk } = useSaveStatus();
  const ready = hydrated && status !== 'loading';
  const { backup, refresh } = useBackupInfo(ready);
  const conflict = useSaveConflict();

  // A newer game's save must never be overwritten; a stale tab must reload first; blocked storage
  // can't keep a replacement. Each leaves only Export.
  const newerOnDisk = status === 'error' && error === LOAD_ERROR_NEWER;
  const lock: SaveLock | null = newerOnDisk
    ? { reason: TRANSFER_COPY.newer, reload: false }
    : conflict
      ? { reason: SETTINGS_COPY.conflict, reload: true }
      : atRisk
        ? { reason: SETTINGS_COPY.blocked, reload: false }
        : null;
  /** A damaged stored save is replaced without a backup (there is no readable save to keep). */
  const unreadable = status === 'error' && !newerOnDisk;

  const [notice, setNotice] = useState<Notice | null>(null);
  const noticeId = useRef(0);
  const announce = useCallback<Announce>((text, tone, options) => {
    noticeId.current += 1;
    setNotice({ id: noticeId.current, text, tone, homeLink: options?.homeLink ?? false });
  }, []);
  const clearNotice = useCallback(() => setNotice(null), []);

  const exportRef = useRef<HTMLButtonElement>(null);
  const afterReset = useCallback(() => {
    refresh();
    // Land on the primary action at the top, right below the result in the live region.
    exportRef.current?.focus();
  }, [refresh]);

  return (
    <main
      id="content"
      className="relative mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 pt-10 pb-24 sm:px-6 sm:pt-14"
    >
      <header>
        <p className="font-mono text-xs font-bold tracking-[0.16em] text-muted-foreground uppercase">
          Save · Motion · About
        </p>
        <h1 className="mt-2 font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
          Settings
        </h1>
        <StatusRegion notice={notice} />
      </header>

      {ready ? (
        <SaveSection
          lock={lock}
          unreadable={unreadable}
          loadError={status === 'error' ? error : null}
          announce={announce}
          clearNotice={clearNotice}
          backup={backup}
          onBackupChange={refresh}
          exportRef={exportRef}
        />
      ) : (
        <Panel id="save" title="Save" busy>
          <p className="text-sm text-muted-foreground">Loading your save…</p>
          <div aria-hidden className="mt-5 flex flex-col gap-3 sm:flex-row">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="shimmer relative h-10 w-36 overflow-hidden rounded-xl bg-muted"
              />
            ))}
          </div>
        </Panel>
      )}

      <Panel
        id="motion"
        title="Motion"
        description="Auto follows your system’s reduced-motion setting."
      >
        <MotionToggle />
      </Panel>

      {ready && (
        <ResetSection lock={lock} unreadable={unreadable} announce={announce} onDone={afterReset} />
      )}

      <AboutSection />
    </main>
  );
}
