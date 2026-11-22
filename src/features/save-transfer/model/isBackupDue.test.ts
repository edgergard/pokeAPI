import { describe, expect, it } from 'vitest';
import { createNewSave, type Save } from '@/entities/save';
import { economy } from '@/shared/config/economy';
import { isBackupDue } from './isBackupDue';

const DAY = 24 * 60 * 60 * 1000;
const { battles, days } = economy.save.backupReminder;
const created = 1_000_000;

function save(meta: Partial<Save['meta']> = {}): Save {
  const s = createNewSave({ seed: 1, now: created, name: 'Rowan' });
  return { ...s, meta: { ...s.meta, ...meta } };
}

describe('isBackupDue', () => {
  it('is not due for a fresh save', () => {
    expect(isBackupDue(save(), created)).toBe(false);
  });

  it('counts battles since the last export', () => {
    expect(isBackupDue(save({ battlesSinceExport: battles - 1 }), created)).toBe(false);
    expect(isBackupDue(save({ battlesSinceExport: battles }), created)).toBe(true);
  });

  it('counts days from creation when never exported', () => {
    expect(isBackupDue(save(), created + days * DAY - 1)).toBe(false);
    expect(isBackupDue(save(), created + days * DAY)).toBe(true);
  });

  it('counts days from the last export', () => {
    const exportedAt = created + 30 * DAY;
    const s = save({ lastExportAt: exportedAt });
    expect(isBackupDue(s, exportedAt + days * DAY - 1)).toBe(false);
    expect(isBackupDue(s, exportedAt + days * DAY)).toBe(true);
  });

  it('is not due right after an export, however old the save', () => {
    const now = created + 365 * DAY;
    expect(isBackupDue(save({ lastExportAt: now, battlesSinceExport: 0 }), now)).toBe(false);
  });
});
