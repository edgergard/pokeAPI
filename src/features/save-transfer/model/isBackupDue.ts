import type { Save } from '@/entities/save';
import { economy } from '@/shared/config/economy';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whether to nudge the player to export ("Back up your progress"): after
 * `economy.save.backupReminder.battles` battles or `.days` days without an export
 * (counted from the save's creation when it was never exported). Pure.
 */
export function isBackupDue(save: Save, now: number): boolean {
  const { battles, days } = economy.save.backupReminder;
  if (save.meta.battlesSinceExport >= battles) return true;
  const since = save.meta.lastExportAt ?? save.meta.createdAt;
  return now - since >= days * DAY_MS;
}
