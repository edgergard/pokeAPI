export type NoticeTone = 'success' | 'error' | 'info';

/** One result in the page's live region. `id` changes every time, so a repeated message is re-announced. */
export type Notice = { id: number; text: string; tone: NoticeTone; homeLink: boolean };

export type Announce = (text: string, tone: NoticeTone, options?: { homeLink?: boolean }) => void;

/** Why Import / Restore / Reset are off; `reload` offers a reload button (another tab saved newer progress). */
export type SaveLock = { reason: string; reload: boolean };

/** Settings-only copy (the save-transfer copy lives in the feature). */
export const SETTINGS_COPY = {
  persistent: 'Saved on this device · persistent',
  atRisk: 'Browser may clear data. Export often.',
  blocked: 'Storage is blocked in this browser, so only Export works.',
  conflict: 'Your progress changed in another tab. Reload this page to keep playing here.',
  reload: 'Reload page',
  replaceKeepsBackup: 'Your current save moves to the backup slot.',
  replaceUnreadable:
    'Your current save can’t be read, so it will be replaced and can’t be kept as a backup.',
  resetKeepsBackup: 'Start over from the first card. Your current save moves to the backup slot.',
  resetUnreadable:
    'Start over from the first card. Your current save can’t be read, so it will be replaced without a backup.',
  neverExported: 'Not exported yet',
  justExported: 'Exported just now',
  noBackup: 'No backup yet',
  importing: 'Importing…',
  exportFailed: 'Couldn’t create the save file in this browser.',
  restored: 'Backup restored. Restore again to undo.',
  reset: 'Progress reset. A new save has started.',
  disclaimer:
    'Unofficial fan project, not affiliated with Nintendo, Game Freak or The Pokémon Company',
} as const;

const dateFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium' });
const dateTimeFormat = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' });

export const formatDate = (ms: number) => dateFormat.format(ms);
export const formatDateTime = (ms: number) => dateTimeFormat.format(ms);
