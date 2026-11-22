import { z } from 'zod';
import { V1_ROSTER_KEY, V1_TRAINER_KEY } from './keys';

/**
 * v1 (Trainer Studio ≤ 3): a localStorage roster of trainers, each with four Pokémon slugs.
 * Only the fields the migration needs; the full v1 shapes live in entities/trainer, which stream 2-home
 * retires — and whose read path rewrites storage, so it is deliberately not imported here.
 * Kept light (no species data): load() reads it on every start; the migration step lives in fromV1.ts.
 */
const v1TrainerSchema = z.object({
  id: z.string().optional(),
  firstName: z.string(),
  lastName: z.string(),
  team: z.array(z.string()),
  savedAt: z.string().optional(),
});

export type V1Trainer = { firstName: string; lastName: string; team: string[] };

/** Every valid trainer in a v1 roster array, in stored order (invalid entries are skipped). */
export function parseV1Trainers(raw: unknown): V1Trainer[] {
  if (!Array.isArray(raw)) return [];
  const trainers: V1Trainer[] = [];
  for (const entry of raw) {
    const parsed = v1TrainerSchema.safeParse(entry);
    if (!parsed.success) continue;
    const { firstName, lastName, team } = parsed.data;
    trainers.push({ firstName, lastName, team });
  }
  return trainers;
}

function readJson(storage: Pick<Storage, 'getItem'>, key: string): unknown {
  try {
    const raw = storage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null; // blocked storage or broken JSON: nothing to migrate from this key
  }
}

const hasId = (entry: unknown, id: string) =>
  typeof entry === 'object' && entry !== null && 'id' in entry && entry.id === id;

/**
 * The v1 document (a roster array) from localStorage: the roster plus the older single-trainer key,
 * appended the way v1's own `loadRoster` did. Read-only. Null when neither key holds a valid trainer.
 */
export function readV1Doc(storage: Pick<Storage, 'getItem'> | null): unknown[] | null {
  if (!storage) return null;
  const roster = readJson(storage, V1_ROSTER_KEY);
  const doc: unknown[] = Array.isArray(roster) ? [...roster] : [];
  const legacy = readJson(storage, V1_TRAINER_KEY);
  const parsedLegacy = v1TrainerSchema.safeParse(legacy);
  if (parsedLegacy.success) {
    // v1 gave the absorbed legacy trainer this id; skip it if the roster already holds it.
    const legacyId = `legacy-${parsedLegacy.data.savedAt ?? ''}`;
    if (!doc.some((entry) => hasId(entry, legacyId))) doc.push(legacy);
  }
  return parseV1Trainers(doc).length > 0 ? doc : null;
}

/** `window.localStorage`, or null where it is missing or blocked. */
export function browserLocalStorage(): Pick<Storage, 'getItem'> | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}
