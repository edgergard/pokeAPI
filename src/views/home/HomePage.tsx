'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSave, useSaveStatus } from '@/entities/save';
import { useHydrated } from '@/shared/lib/useHydrated';
import { homeStep } from './model/onboarding';
import { noteOnboardingStep } from './model/session';
import { Hub } from './ui/Hub';
import { Onboarding, type OnboardingView } from './ui/Onboarding';
import { SaveRescue } from './ui/SaveRescue';
import { eyebrow } from './ui/styles';

export const FOOTER_TEXT =
  'Unofficial fan project, not affiliated with Nintendo, Game Freak or The Pokémon Company · Data: PokéAPI';

/** Aurora glows behind the onboarding (CSS drift only, under `data-motion="full"`). */
const AURORA_BLOBS = ['aurora-blob-a', 'aurora-blob-b', 'aurora-blob-c'] as const;

type View = OnboardingView | 'hub' | 'error';

/**
 * Home (design.md screen `home`): onboarding until the first Pokémon joins the team, then the hub.
 * The prerendered HTML shows the heading and the hero copy with a skeleton where the action goes,
 * so returning players never see the hero button flash before their save loads.
 */
export function HomePage() {
  const hydrated = useHydrated();
  const { status, error } = useSaveStatus();
  const step = useSave(homeStep);

  const view: View =
    !hydrated || status === 'loading' || (status === 'ready' && step === undefined)
      ? 'loading'
      : status === 'error'
        ? 'error'
        : step === 'done' || step === undefined
          ? 'hub'
          : step;

  useEffect(() => {
    if (view !== 'loading' && view !== 'error' && view !== 'hub') noteOnboardingStep(view);
  }, [view]);

  // One polite live region for the whole page, present from the first paint so changes are announced.
  const [announcement, setAnnouncement] = useState({ id: 0, text: '' });
  const announce = useCallback(
    (text: string) => setAnnouncement((prev) => ({ id: prev.id + 1, text })),
    [],
  );

  const hub = view === 'hub';

  return (
    <>
      <main
        id="content"
        data-view={view}
        className="relative isolate mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-6xl flex-col px-4 py-8 sm:px-6 lg:px-8 lg:py-10"
      >
        {!hub && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[40rem] aurora"
          >
            {AURORA_BLOBS.map((blob) => (
              <span key={blob} className="absolute inset-0">
                <span className={`aurora-blob ${blob}`} />
              </span>
            ))}
          </div>
        )}

        {hub ? (
          <Hub />
        ) : view === 'error' ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 pt-6">
            <h1 className={`${eyebrow} text-primary`}>Trainer Studio</h1>
            <SaveRescue error={error} announce={announce} />
          </div>
        ) : (
          <Onboarding view={view} announce={announce} />
        )}

        <p role="status" data-testid="home-announcer" className="sr-only">
          {announcement.text && <span key={announcement.id}>{announcement.text}</span>}
        </p>
      </main>
      <footer className="px-4 pt-4 pb-24 text-center text-xs text-muted-foreground lg:pb-8">
        {FOOTER_TEXT}
      </footer>
    </>
  );
}
