/** Player-facing copy for the save-transfer flow (design.md screen `settings`, flow `save-transfer`). */
export const TRANSFER_COPY = {
  damaged: 'This file is damaged or not a Trainer Studio save',
  newer: 'Made by a newer version. Update the page and try again',
  imported: 'Save imported',
  upgraded: (fromVersion: number) => `Upgraded from v${fromVersion}`,
  backupFailed: 'Couldn’t move your current save to the backup slot. Nothing was changed.',
} as const;
