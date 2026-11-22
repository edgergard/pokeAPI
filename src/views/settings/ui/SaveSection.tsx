import { useRef, useState, type ChangeEvent, type Ref } from 'react';
import { Download, History, RefreshCw, ShieldCheck, TriangleAlert, Upload } from 'lucide-react';
import { useSave, usePersistState, type Save, type SaveBackup } from '@/entities/save';
import {
  TRANSFER_COPY,
  applyImport,
  exportSave,
  readSaveFile,
  restoreBackup,
} from '@/features/save-transfer';
import { Button } from '@/shared/ui/Button';
import { Dialog } from '@/shared/ui/Dialog';
import {
  SETTINGS_COPY,
  formatDate,
  formatDateTime,
  type Announce,
  type SaveLock,
} from '../model/notice';
import { Panel } from './Panel';
import { unavailableClass } from './unavailable';

type Busy = 'export' | 'import' | 'restore' | null;
type PendingImport = { save: Save; migratedFrom: number | null };

const LOCK_ID = 'settings-save-lock';
const RESTORE_HINT_ID = 'settings-restore-hint';

const fileErrorCopy = {
  damaged: TRANSFER_COPY.damaged,
  newer: TRANSFER_COPY.newer,
  unavailable: TRANSFER_COPY.unavailable,
} as const;

/**
 * Storage status, last export, Export / Import / Restore backup (design.md screen `settings`).
 * Buttons never use `disabled` for states their own action causes: they stay focusable with
 * `aria-disabled` (and ignore presses), so keyboard and screen-reader focus never drops to <body>.
 */
export function SaveSection({
  lock,
  unreadable,
  loadError,
  announce,
  clearNotice,
  backup,
  onBackupChange,
  exportRef,
}: {
  /** Why Import / Restore can't be used right now (storage blocked, newer save, another tab), or null. */
  lock: SaveLock | null;
  /** The stored save can't be read: replacing it won't keep a backup. */
  unreadable: boolean;
  /** The store's load error, shown as is. */
  loadError: string | null;
  announce: Announce;
  clearNotice: () => void;
  backup: SaveBackup | null | undefined;
  onBackupChange: () => void;
  exportRef: Ref<HTMLButtonElement>;
}) {
  const lastExportAt = useSave((s) => s.meta.lastExportAt);
  const hasSave = lastExportAt !== undefined;
  const persist = usePersistState();
  const [busy, setBusyState] = useState<Busy>(null);
  /** Source of truth for the guards: two presses in the same tick both see the first one. */
  const busyRef = useRef<Busy>(null);
  const [justExportedAt, setJustExportedAt] = useState<number | null>(null);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const importRef = useRef<HTMLButtonElement>(null);

  const setBusy = (next: Busy) => {
    busyRef.current = next;
    setBusyState(next);
  };

  const locked = lock !== null;
  const persistent = !locked && persist === 'persisted';
  const storageKnown = locked || persist !== 'unknown';
  const exportOff = !hasSave || busy !== null;
  const importOff = locked || busy !== null;
  const restoreOff = !backup || locked || busy !== null;

  async function onExport() {
    if (exportOff || busyRef.current) return;
    setBusy('export');
    try {
      const now = Date.now();
      const result = await exportSave({ now });
      if (result) {
        setJustExportedAt(now);
        announce(`${SETTINGS_COPY.justExported} · ${result.fileName}`, 'success');
      }
    } catch {
      announce(SETTINGS_COPY.exportFailed, 'error');
    } finally {
      setBusy(null);
    }
  }

  function onPickFile() {
    if (importOff || busyRef.current) return;
    fileRef.current?.click();
  }

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // picking the same file again still fires change
    if (!file || locked || busyRef.current) return;
    setBusy('import');
    announce(SETTINGS_COPY.importing, 'info');
    const result = await readSaveFile(file);
    setBusy(null);
    if (!result.ok) {
      announce(fileErrorCopy[result.error], 'error');
      return;
    }
    clearNotice();
    // The native dialog returns focus to whatever had it when it opened: make that the Import button
    // (the file picker may have left focus elsewhere).
    importRef.current?.focus({ preventScroll: true });
    setPending({ save: result.save, migratedFrom: result.migratedFrom });
  }

  /** Cancel, Esc, the close button and the backdrop: ignored while the replace is running. */
  function onCloseDialog() {
    if (busyRef.current === 'import') return;
    setPending(null);
  }

  async function onConfirmImport() {
    if (!pending || busyRef.current) return;
    const { save, migratedFrom } = pending;
    setBusy('import');
    const ok = await applyImport(save);
    setBusy(null);
    setPending(null);
    if (!ok) {
      announce(TRANSFER_COPY.backupFailed, 'error');
      return;
    }
    setJustExportedAt(null);
    onBackupChange();
    const text = migratedFrom
      ? `${TRANSFER_COPY.imported} · ${TRANSFER_COPY.upgraded(migratedFrom)}`
      : TRANSFER_COPY.imported;
    announce(text, 'success', { homeLink: true });
  }

  async function onRestore() {
    if (restoreOff || busyRef.current) return;
    setBusy('restore');
    const result = await restoreBackup();
    setBusy(null);
    onBackupChange();
    if (result === 'restored') {
      setJustExportedAt(null);
      announce(SETTINGS_COPY.restored, 'success', { homeLink: true });
    } else {
      announce(result === 'empty' ? SETTINGS_COPY.noBackup : TRANSFER_COPY.backupFailed, 'error');
    }
  }

  const lastExportText = !hasSave
    ? null
    : lastExportAt !== null && lastExportAt === justExportedAt
      ? SETTINGS_COPY.justExported
      : lastExportAt === null
        ? SETTINGS_COPY.neverExported
        : `Last export: ${formatDate(lastExportAt)}`;

  const restoreHint =
    backup === undefined
      ? ' '
      : backup
        ? `Backup from ${formatDateTime(backup.savedAt)}`
        : SETTINGS_COPY.noBackup;

  return (
    <Panel
      id="save"
      title="Save"
      description="Your progress lives in this browser. Export it to keep a copy or move it to another browser."
      busy={busy !== null}
    >
      <div className="flex flex-col gap-1.5 rounded-2xl border border-white/8 bg-muted/60 px-4 py-3">
        <p
          className="flex min-h-6 items-center gap-2 text-sm font-medium"
          data-persistent={storageKnown ? persistent : undefined}
        >
          {storageKnown &&
            (persistent ? (
              <ShieldCheck aria-hidden className="size-4 shrink-0 text-rarity-uncommon" />
            ) : (
              <TriangleAlert aria-hidden className="size-4 shrink-0 text-rarity-legendary" />
            ))}
          {storageKnown && (persistent ? SETTINGS_COPY.persistent : SETTINGS_COPY.atRisk)}
        </p>
        {lastExportText && <p className="text-sm text-muted-foreground">{lastExportText}</p>}
        {loadError && <p className="text-sm text-destructive">{loadError}</p>}
      </div>

      {lock && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <p id={LOCK_ID} className="text-sm text-muted-foreground">
            {lock.reason}
          </p>
          {lock.reload && (
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="cursor-pointer"
            >
              <RefreshCw aria-hidden className="size-4" />
              {SETTINGS_COPY.reload}
            </Button>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
        <Button
          ref={exportRef}
          onClick={onExport}
          aria-disabled={exportOff || undefined}
          className={`cursor-pointer justify-center ${unavailableClass}`}
        >
          <Download aria-hidden className="size-4" />
          Export save
        </Button>

        <Button
          ref={importRef}
          variant="outline"
          onClick={onPickFile}
          aria-disabled={importOff || undefined}
          aria-describedby={lock ? LOCK_ID : undefined}
          aria-busy={busy === 'import' || undefined}
          className={`cursor-pointer justify-center ${unavailableClass}`}
        >
          <Upload aria-hidden className="size-4" />
          {busy === 'import' ? SETTINGS_COPY.importing : 'Import save'}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,text/plain"
          onChange={onFileChange}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
        />

        <div className="flex flex-col gap-1.5 sm:items-start">
          <Button
            variant="outline"
            onClick={onRestore}
            aria-disabled={restoreOff || undefined}
            aria-describedby={joinIds(RESTORE_HINT_ID, lock !== null && LOCK_ID)}
            className={`cursor-pointer justify-center ${unavailableClass}`}
          >
            <History aria-hidden className="size-4" />
            Restore backup
          </Button>
          <p id={RESTORE_HINT_ID} className="min-h-5 px-1 text-xs text-muted-foreground">
            {restoreHint}
          </p>
        </div>
      </div>

      <Dialog
        open={pending !== null}
        onClose={onCloseDialog}
        title="Replace current progress?"
        description={
          unreadable ? SETTINGS_COPY.replaceUnreadable : SETTINGS_COPY.replaceKeepsBackup
        }
        footer={
          <>
            <Button
              variant="ghost"
              onClick={onCloseDialog}
              aria-disabled={busy === 'import' || undefined}
              className={`cursor-pointer ${unavailableClass}`}
            >
              Cancel
            </Button>
            <Button
              onClick={onConfirmImport}
              aria-disabled={busy !== null || undefined}
              aria-busy={busy === 'import' || undefined}
              className={`cursor-pointer ${unavailableClass}`}
            >
              Replace
            </Button>
          </>
        }
      >
        {pending && <ImportSummary {...pending} />}
      </Dialog>
    </Panel>
  );
}

function joinIds(...ids: (string | false)[]) {
  return ids.filter(Boolean).join(' ');
}

function ImportSummary({ save, migratedFrom }: PendingImport) {
  const owned = Object.keys(save.collection).length;
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
      <dt className="text-muted-foreground">Trainer</dt>
      <dd className="font-semibold">
        {save.trainer.name} · Lv {save.trainer.level}
      </dd>
      <dt className="text-muted-foreground">Pokémon</dt>
      <dd className="font-semibold">{owned}</dd>
      <dt className="text-muted-foreground">Created</dt>
      <dd className="font-semibold">{formatDate(save.meta.createdAt)}</dd>
      {migratedFrom !== null && (
        <>
          <dt className="text-muted-foreground">Format</dt>
          <dd className="font-semibold">{TRANSFER_COPY.upgraded(migratedFrom)}</dd>
        </>
      )}
    </dl>
  );
}
