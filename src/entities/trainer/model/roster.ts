import { useMemo } from 'react';
import { z } from 'zod';
import { createStorageStore } from '@/shared/lib/storageStore';
import { swapSlots } from './swapSlots';

export const TEAM_SIZE = 4;
export const ROSTER_KEY = 'trainer-studio:roster:v1';
export const LEGACY_TRAINER_KEY = 'trainer-studio:trainer:v1';

export type Trainer = {
  id: string;
  firstName: string;
  lastName: string;
  /** Pokémon slugs, in slot order. Details are re-fetched (and cached) by name. */
  team: string[];
  savedAt: string;
};

const teamSchema = z
  .array(z.string().min(1))
  .length(TEAM_SIZE)
  .refine((team) => new Set(team).size === team.length);

const trainerSchema = z.object({
  id: z.string().min(1),
  firstName: z.string(),
  lastName: z.string(),
  team: teamSchema,
  savedAt: z.string(),
});

const legacySchema = trainerSchema.omit({ id: true });

/** Keeps every valid entry (first occurrence per id) and silently drops the rest. */
export function parseRoster(raw: unknown): Trainer[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const trainers: Trainer[] = [];
  for (const entry of raw) {
    const parsed = trainerSchema.safeParse(entry);
    if (!parsed.success || seen.has(parsed.data.id)) continue;
    seen.add(parsed.data.id);
    trainers.push(parsed.data);
  }
  return trainers;
}

/** The pre-roster single trainer, given a deterministic id. */
export function migrateLegacy(raw: unknown): Trainer | null {
  const parsed = legacySchema.safeParse(raw);
  return parsed.success ? { ...parsed.data, id: `legacy-${parsed.data.savedAt}` } : null;
}

function readJson(storage: Pick<Storage, 'getItem'>, key: string): unknown {
  try {
    const raw = storage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

/** The stored roster plus a migrated legacy trainer. Read-only: `persistRoster` retires the legacy key. Never throws. */
export function loadRoster(storage: Pick<Storage, 'getItem'>): Trainer[] {
  const roster = parseRoster(readJson(storage, ROSTER_KEY));
  const legacy = migrateLegacy(readJson(storage, LEGACY_TRAINER_KEY));
  return legacy && !roster.some((t) => t.id === legacy.id) ? [...roster, legacy] : roster;
}

/**
 * Writes the roster, then (only if that succeeded) removes the legacy key it may have absorbed.
 * Storage failures are swallowed: the legacy key stays, so nothing is lost on reload.
 */
export function persistRoster(storage: Pick<Storage, 'setItem' | 'removeItem'>, trainers: readonly Trainer[]): void {
  try {
    storage.setItem(ROSTER_KEY, JSON.stringify(trainers));
    storage.removeItem(LEGACY_TRAINER_KEY);
  } catch {
    /* storage unavailable — keep in-memory value */
  }
}

const EMPTY_ROSTER: Trainer[] = [];

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null; // blocked (e.g. some privacy modes): the roster lives in memory only
  }
}

/**
 * The roster, shared by every page. The first read also persists, which retires a migrated legacy
 * key right away (as the pre-store hook did on mount).
 */
const rosterStore = createStorageStore<Trainer[]>({
  read: () => {
    const store = storage();
    if (!store) return EMPTY_ROSTER;
    const roster = loadRoster(store);
    persistRoster(store, roster);
    return roster;
  },
  write: (trainers) => {
    const store = storage();
    if (store) persistRoster(store, trainers);
  },
  serverValue: EMPTY_ROSTER,
  syncKey: ROSTER_KEY,
});

const byNewest = (a: Trainer, b: Trainer) => (a.savedAt < b.savedAt ? 1 : a.savedAt > b.savedAt ? -1 : 0);

/**
 * The visitor's trainers, persisted across reloads and kept in sync across tabs.
 * Prerendered HTML has no roster; the stored one appears on hydration. Storage failures degrade to memory.
 */
export function useRoster() {
  const stored = rosterStore.useValue();
  const setStored = rosterStore.set;

  const trainers = useMemo(() => [...stored].sort(byNewest), [stored]);

  return {
    trainers,
    latest: trainers[0] ?? null,
    add(data: { firstName: string; lastName: string; team: string[] }): Trainer {
      const trainer: Trainer = { ...data, id: crypto.randomUUID(), savedAt: new Date().toISOString() };
      setStored((current) => [...current, trainer]);
      return trainer;
    },
    remove: (id: string) => setStored((current) => current.filter((t) => t.id !== id)),
    /** Swaps two slots. `savedAt` is kept: reordering is not a new save (no lock-in replay). */
    swap: (id: string, from: number, to: number) =>
      setStored((current) =>
        current.map((t) => {
          if (t.id !== id) return t;
          const team = swapSlots(t.team, from, to);
          return team === t.team ? t : { ...t, team: [...team] };
        }),
      ),
  };
}
