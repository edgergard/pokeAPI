import { useSyncExternalStore } from 'react';

/**
 * Set once another tab writes a newer save than the one this tab holds: from then on this tab stops
 * writing (its progress is stale) and the UI asks the player to reload.
 */
let conflict = false;
const listeners = new Set<() => void>();

export function reportSaveConflict(): void {
  if (conflict) return;
  conflict = true;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** True when another tab saved newer progress; this tab no longer writes until it reloads. */
export function useSaveConflict(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => conflict,
    () => false,
  );
}

/** Test helper. */
export function __resetSaveConflictForTests(): void {
  conflict = false;
  listeners.clear();
}
