import { useSyncExternalStore } from 'react';
import { subscribe as subscribeSave } from '@/entities/save';

/** Countdowns ("New quests in 5 h") only need minute precision. */
const TICK_MS = 60_000;

let snapshot: number | null = null;
let subscribers = 0;

const read = () => (snapshot ??= Date.now());

/**
 * The wall clock for render-time reads (quest board, backup reminder) without calling `Date.now()` in
 * render: re-read on every save change, when the tab becomes visible again and once a minute.
 */
function subscribeClock(onChange: () => void): () => void {
  const tick = () => {
    snapshot = Date.now();
    onChange();
  };
  subscribers += 1;
  // A first render after a long unmount may have read an old value: refresh it right away.
  snapshot = Date.now();
  const timer = setInterval(tick, TICK_MS);
  const onVisibility = () => {
    if (document.visibilityState === 'visible') tick();
  };
  document.addEventListener('visibilitychange', onVisibility);
  const unsubscribeSave = subscribeSave(tick);
  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisibility);
    unsubscribeSave();
    subscribers -= 1;
    if (subscribers === 0) snapshot = null;
  };
}

/** Current time in ms, fresh after every save update, tab return and minute (0 on the server). */
export function useNow(): number {
  return useSyncExternalStore(subscribeClock, read, () => 0);
}

/** Test helper: forget the cached time. */
export function __resetNowForTests(): void {
  snapshot = null;
  subscribers = 0;
}
