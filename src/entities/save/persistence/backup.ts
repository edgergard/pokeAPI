import { z } from 'zod';
import type { Save } from '../model/schema';
import { BACKUP_KEY } from './keys';
import { defaultKeyValue, type KeyValueStore } from './kv';
import { detectVersion, migrateSave } from './migrate';

/** The backup slot: one earlier save and when it was moved there (ms). */
export type SaveBackup = { savedAt: number; save: Save };

const slotSchema = z.object({ savedAt: z.number().int(), save: z.unknown() });

/**
 * The save in the backup slot (migrated if an older game wrote it), or null when the slot is empty,
 * unreadable or storage is blocked. Never throws.
 */
export async function readBackup(
  kv: KeyValueStore = defaultKeyValue(),
): Promise<SaveBackup | null> {
  let raw: unknown;
  try {
    raw = await kv.get(BACKUP_KEY);
  } catch {
    return null;
  }
  const slot = slotSchema.safeParse(raw);
  if (!slot.success) return null;
  const version = detectVersion(slot.data.save);
  if (version === null) return null;
  const result = await migrateSave(version, slot.data.save, { now: slot.data.savedAt });
  return result.ok ? { savedAt: slot.data.savedAt, save: result.save } : null;
}

/** Moves `save` into the backup slot (replacing what was there). Resolves false when it could not write. */
export async function writeBackup(
  save: Save,
  savedAt: number = Date.now(),
  kv: KeyValueStore = defaultKeyValue(),
): Promise<boolean> {
  try {
    await kv.set(BACKUP_KEY, { savedAt, save } satisfies SaveBackup);
    return true;
  } catch {
    return false;
  }
}
