'use client';

import { useCallback, useRef, useState } from 'react';
import { useSaveStatus } from '@/entities/save';
import { MotionToggle } from '@/features/motion-toggle/MotionToggle';
import { useHydrated } from '@/shared/lib/useHydrated';
import type { Announce, Notice } from './model/notice';
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
    // The armed Reset button disables itself: land on the primary action, next to the result.
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
          blocked={atRisk}
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

      {ready && <ResetSection blocked={atRisk} announce={announce} onDone={afterReset} />}

      <AboutSection />
    </main>
  );
}
