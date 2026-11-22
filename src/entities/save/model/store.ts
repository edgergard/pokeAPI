import { useSyncExternalStore } from 'react';
import type { Save } from './schema';

/**
 * Save store (contract). One in-memory Save, loaded once from a persistence adapter and written back
 * after every update. UI reads with `useSave(selector)` and writes with `updateSave(fn)` — never
 * IndexedDB/localStorage directly. Stream 1-save provides the real IndexedDB adapter.
 */

export type SaveStatus = 'loading' | 'ready' | 'error';

export type LoadResult =
  { kind: 'loaded'; save: Save } | { kind: 'empty' } | { kind: 'error'; reason: string };

export interface SavePersistence {
  /** Load and migrate the stored save. Never throws: errors come back as `{ kind: 'error' }`. */
  load(): Promise<LoadResult>;
  /** Persist the given save (implementations may debounce). Resolves false when it could not write. */
  write(save: Save): Promise<boolean>;
  /** Whether writes reach durable storage (false: storage blocked → in-memory only). */
  readonly durable: boolean;
}

type State = { status: SaveStatus; save: Save | null; error: string | null; writeFailed: boolean };

let state: State = { status: 'loading', save: null, error: null, writeFailed: false };
const listeners = new Set<() => void>();
let persistence: SavePersistence | null = null;

function emit(next: State) {
  state = next;
  for (const l of listeners) l();
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getState(): State {
  return state;
}

/** The current save, or null while loading / after a load error. */
export function getSave(): Save | null {
  return state.save;
}

/**
 * Load the save once (called by SaveProvider on mount). `createFresh` builds a new save when storage is
 * empty; on a load error the store stays in `error` until `resolveLoadError` replaces or restores it.
 */
export async function initSave(adapter: SavePersistence, createFresh: () => Save): Promise<void> {
  persistence = adapter;
  const result = await adapter.load();
  if (result.kind === 'loaded') {
    emit({ ...state, status: 'ready', save: result.save, error: null });
  } else if (result.kind === 'empty') {
    const save = createFresh();
    emit({ ...state, status: 'ready', save, error: null });
    void write(save);
  } else {
    emit({ ...state, status: 'error', save: null, error: result.reason });
  }
}

/** Replace the whole save (import, restore backup, start fresh after a load error). */
export function replaceSave(save: Save): void {
  emit({ ...state, status: 'ready', save, error: null });
  void write(save);
}

/** Apply a pure update `fn(save) => save` and persist it. No-op until the save is loaded. */
export function updateSave(fn: (save: Save) => Save): void {
  if (!state.save) return;
  const next = fn(state.save);
  if (next === state.save) return;
  emit({ ...state, save: next });
  void write(next);
}

async function write(save: Save) {
  if (!persistence) return;
  const ok = await persistence.write(save);
  if (ok === state.writeFailed) emit({ ...state, writeFailed: !ok });
}

/** True when the last write failed or storage is not durable (show the "export to keep it" banner). */
export function isStorageAtRisk(): boolean {
  return state.writeFailed || (persistence !== null && !persistence.durable);
}

const serverState: State = { status: 'loading', save: null, error: null, writeFailed: false };

/** Read a slice of the save. Returns `undefined` while loading (server render, before hydration). */
export function useSave<T>(selector: (save: Save) => T): T | undefined {
  const s = useSyncExternalStore(subscribe, getState, () => serverState);
  return s.save ? selector(s.save) : undefined;
}

/** Load status for gating UI (`loading` on the server and until the save is read). */
export function useSaveStatus(): { status: SaveStatus; error: string | null; atRisk: boolean } {
  const s = useSyncExternalStore(subscribe, getState, () => serverState);
  return { status: s.status, error: s.error, atRisk: isStorageAtRisk() };
}

/** Test helper: reset the module state. */
export function __resetSaveStoreForTests(): void {
  state = { status: 'loading', save: null, error: null, writeFailed: false };
  persistence = null;
  listeners.clear();
}
