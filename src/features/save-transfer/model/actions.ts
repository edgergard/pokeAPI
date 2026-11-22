import {
  commitSave,
  createNewSave,
  getSave,
  readBackup,
  replaceSave,
  updateSave,
  type Save,
} from '@/entities/save';
import { downloadTextFile } from '../lib/downloadTextFile';
import { decodeSaveFile, encodeSaveFile, exportFileName, type DecodeResult } from './envelope';
import { GAME_VERSION } from './gameVersion';

/** A save file is a few dozen KB; anything this big is not one (and isn't worth reading into memory). */
const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** The save after an export: the reminder counters start over. Pure. */
export function markExported(save: Save, now: number): Save {
  return { ...save, meta: { ...save.meta, lastExportAt: now, battlesSinceExport: 0 } };
}

/**
 * Downloads the current save as `trainer-studio-YYYY-MM-DD.txt` and records the export.
 * The file already carries the updated export date, so importing it restores exactly this save.
 * Resolves null when there is no save to export; rejects if the browser can't encode the file.
 */
export async function exportSave({
  now = Date.now(),
  download = downloadTextFile,
}: { now?: number; download?: (fileName: string, text: string) => void } = {}): Promise<{
  fileName: string;
} | null> {
  const save = getSave();
  if (!save) return null;
  const text = await encodeSaveFile(markExported(save, now), { now, gameVersion: GAME_VERSION });
  const fileName = exportFileName(now);
  download(fileName, text);
  updateSave((current) => markExported(current, now));
  return { fileName };
}

/** Reads and checks a picked file (see `decodeSaveFile`). Changes nothing. Never throws. */
export async function readSaveFile(file: Blob, now: number = Date.now()): Promise<DecodeResult> {
  if (file.size > MAX_FILE_BYTES) return { ok: false, error: 'damaged' };
  let text: string;
  try {
    text = await file.text();
  } catch {
    return { ok: false, error: 'damaged' };
  }
  return decodeSaveFile(text, { now });
}

/**
 * Moves the current save (if any) to the backup slot and makes `next` the current save. Both keys are
 * stored in one transaction before memory changes, so a closed tab never keeps only half of it.
 * Resolves false — and changes nothing — when they can't be stored.
 */
async function replaceKeepingBackup(next: Save, now: number): Promise<boolean> {
  const current = getSave();
  if (!(await commitSave(next, current ? { savedAt: now, save: current } : null))) return false;
  replaceSave(next);
  return true;
}

/** Replaces the current save with an imported one; the current save moves to the backup slot. */
export function applyImport(save: Save, now: number = Date.now()): Promise<boolean> {
  return replaceKeepingBackup(save, now);
}

export type RestoreResult = 'restored' | 'empty' | 'failed';

/**
 * Swaps the backup slot and the current save: the backup becomes current and the current save becomes
 * the backup, so a second restore undoes the first.
 */
export async function restoreBackup(now: number = Date.now()): Promise<RestoreResult> {
  const backup = await readBackup();
  if (!backup) return 'empty';
  return (await replaceKeepingBackup(backup.save, now)) ? 'restored' : 'failed';
}

function randomSeed(): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] ?? 1;
}

/** A brand-new save with the same default name pattern as SaveProvider. */
export function createFreshSave(now: number, seed: number = randomSeed()): Save {
  return createNewSave({ seed, now, name: `Trainer ${(seed % 9000) + 1000}` });
}

/** Starts over (onboarding from the hero step); the current save moves to the backup slot. */
export function resetProgress(now: number = Date.now(), seed?: number): Promise<boolean> {
  return replaceKeepingBackup(createFreshSave(now, seed), now);
}
