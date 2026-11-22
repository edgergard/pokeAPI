'use client';

import { useEffect, type ReactNode } from 'react';
import {
  createDefaultPersistence,
  createNewSave,
  initSave,
  registerGameEventReducer,
} from '@/entities/save';
import { questEventReducer } from '@/entities/quest';

// Game events (battles, capsules, level-ups) advance daily quests.
registerGameEventReducer(questEventReducer);

let started = false;

function randomSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] ?? 1;
}

/** Loads the player save once per page load. UI gates on `useSaveStatus()` until it is ready. */
export function SaveProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (started) return;
    started = true;
    const seed = randomSeed();
    void initSave(createDefaultPersistence(), () =>
      createNewSave({ seed, now: Date.now(), name: `Trainer ${(seed % 9000) + 1000}` }),
    );
  }, []);
  return children;
}
