'use client';

import { useEffect, useRef, useState, type MouseEvent } from 'react';
import type { TrainerUnlock } from '@/entities/progression';
import { refreshQuests } from '@/entities/quest';
import {
  requestPersist,
  updateSave,
  usePersistState,
  useSave,
  useSaveStatus,
} from '@/entities/save';
import { isBackupDue } from '@/features/save-transfer';
import { LevelUpDialog, primaryAction } from '@/widgets/level-up';
import { TeamDialog } from '@/widgets/team-dialog';
import { isFreshV1Import } from '../model/onboarding';
import { markFinishShown, onboardingJustFinished } from '../model/session';
import { useNow } from '../model/useNow';
import { CapsuleTray } from './CapsuleTray';
import { HubBanners } from './HubBanners';
import { HubQuests } from './HubQuests';
import { CollectionTile, NextStageCard, TeamStrip, TrainerStrip } from './HubSections';

/** Issues due daily quests: always with the time of the call, never one captured at render. */
const refreshNow = () => updateSave((s) => refreshQuests(s, Date.now()));

/** After a dialog's exit (Dialog's 300 ms fallback), so its native focus restore has happened. */
const DIALOG_EXIT_MS = 350;

/** A trainer level-up to show: the new level and what it unlocked. */
export type HubLevelUp = { toLevel: number; unlocks: TrainerUnlock[] };

/**
 * The hub (design.md screen `home`, step `done`): the player's daily starting point. Top to bottom:
 * notices, trainer strip, next stage, team, daily quests, capsules and the collection tile. It owns
 * the team dialog ("Edit team", level-up "Fill slot N") and the level-up after a quest claim.
 */
export function Hub({ announce }: { announce: (text: string) => void }) {
  const save = useSave((s) => s);
  const done = useSave((s) => s.onboarding.step === 'done');
  const { atRisk } = useSaveStatus();
  const persist = usePersistState();
  const now = useNow();
  // Pure read, so StrictMode's double initialiser agrees; marked as shown after mount.
  const [celebrate] = useState(onboardingJustFinished);
  const [team, setTeam] = useState<{ open: boolean; highlight: number | null }>({
    open: false,
    highlight: null,
  });
  const [levelUp, setLevelUp] = useState<{ result: HubLevelUp; open: boolean } | null>(null);
  const questsHeadingRef = useRef<HTMLHeadingElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  /** "See quests" was pressed: focus the quest list once the level-up has closed. */
  const seeQuests = useRef(false);

  useEffect(() => {
    if (celebrate) markFinishShown();
  }, [celebrate]);
  useEffect(() => () => clearTimeout(timer.current), []);

  // Players who skipped onboarding (v1 or imported saves) never hit its persist request: ask here
  // (once per page load; later calls reuse the first request).
  useEffect(() => {
    if (done) void requestPersist();
  }, [done]);

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

  const afterDialogExit = (fn: () => void) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(fn, DIALOG_EXIT_MS);
  };

  const closeLevelUp = () => {
    setLevelUp((l) => (l ? { ...l, open: false } : l));
    if (!seeQuests.current) return;
    seeQuests.current = false;
    afterDialogExit(() => {
      const heading = questsHeadingRef.current;
      heading?.focus({ preventScroll: true });
      heading?.scrollIntoView?.({ block: 'start' });
    });
  };

  // "See quests" is a link to Home: on Home, stay put and focus the quest list instead.
  const onLevelUpClick = (event: MouseEvent<HTMLDivElement>) => {
    const action = levelUp && primaryAction(levelUp.result.unlocks);
    if (action?.kind !== 'link' || action.href !== '/') return;
    const link = event.target instanceof Element ? event.target.closest('a') : null;
    if (!link) return;
    event.preventDefault();
    seeQuests.current = true;
  };

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
          <TeamStrip save={save} onEditTeam={() => setTeam({ open: true, highlight: null })} />
        </div>
        <div className="flex min-w-0 flex-col gap-6">
          <HubQuests
            save={save}
            now={now}
            announce={announce}
            headingRef={questsHeadingRef}
            onLevelUp={(result) => setLevelUp({ result, open: true })}
          />
          <CapsuleTray save={save} />
          <CollectionTile count={owned} />
        </div>
      </div>

      <TeamDialog
        open={team.open}
        highlightSlot={team.highlight}
        onClose={() => setTeam((t) => ({ ...t, open: false }))}
      />
      {levelUp && (
        <div className="contents" onClickCapture={onLevelUpClick}>
          <LevelUpDialog
            result={levelUp.result}
            open={levelUp.open}
            onClose={closeLevelUp}
            onFillSlot={(slot) => {
              setLevelUp((l) => (l ? { ...l, open: false } : l));
              // After the level-up has closed and handed focus back: the team dialog then returns
              // focus there too.
              afterDialogExit(() => setTeam({ open: true, highlight: slot }));
            }}
          />
        </div>
      )}
    </div>
  );
}
