export type NoticeTone = 'success' | 'error' | 'info';

/** One result in the page's live region. `id` changes every time, so a repeated message is re-announced. */
export type Notice = { id: number; text: string; tone: NoticeTone; homeLink: boolean };

export type Announce = (text: string, tone: NoticeTone, options?: { homeLink?: boolean }) => void;

/** Settings-only copy (the save-transfer copy lives in the feature). */
export const SETTINGS_COPY = {
  persistent: 'Saved on this device · persistent',
  atRisk: 'Browser may clear data. Export often.',
  blocked: 'Storage is blocked in this browser, so only Export works.',
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
