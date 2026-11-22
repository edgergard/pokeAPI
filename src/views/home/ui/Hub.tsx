'use client';

import { useEffect, useState } from 'react';
import { refreshQuests } from '@/entities/quest';
import { updateSave, usePersistState, useSave, useSaveStatus } from '@/entities/save';
import { isBackupDue } from '@/features/save-transfer';
import { isFreshV1Import } from '../model/onboarding';
import { markFinishShown, onboardingJustFinished } from '../model/session';
import { useNow } from '../model/useNow';
import { CapsuleTray } from './CapsuleTray';
import { HubBanners } from './HubBanners';
import { HubQuests } from './HubQuests';
import { CollectionTile, NextStageCard, TeamStrip, TrainerStrip } from './HubSections';

/** Issues due daily quests: always with the time of the call, never one captured at render. */
const refreshNow = () => updateSave((s) => refreshQuests(s, Date.now()));

/**
 * The hub (design.md screen `home`, step `done`): the player's daily starting point. Top to bottom:
 * notices, trainer strip, next stage, team, daily quests, capsules and the collection tile.
 */
export function Hub({ announce }: { announce: (text: string) => void }) {
  const save = useSave((s) => s);
  const { atRisk } = useSaveStatus();
  const persist = usePersistState();
  const now = useNow();
  // Pure read, so StrictMode's double initialiser agrees; marked as shown after mount.
  const [celebrate] = useState(onboardingJustFinished);
  useEffect(() => {
    if (celebrate) markFinishShown();
  }, [celebrate]);

  // Daily quests refill on the hub and whenever the tab comes back.
  useEffect(() => {
    refreshNow();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') refreshNow();
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  if (!save) return null;
  const owned = Object.keys(save.collection).length;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="sr-only">Trainer Studio</h1>
      <HubBanners
        atRisk={atRisk}
        persist={persist}
        backupDue={isBackupDue(save, now)}
        v1Imported={isFreshV1Import(save) ? owned : null}
      />
      <TrainerStrip trainer={save.trainer} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <NextStageCard ladder={save.ladder} celebrate={celebrate} />
          <TeamStrip save={save} />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <HubQuests save={save} now={now} announce={announce} />
          <CapsuleTray save={save} />
          <CollectionTile count={owned} />
        </div>
      </div>
    </div>
  );
}
