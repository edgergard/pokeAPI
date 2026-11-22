import { useRef, useState, type ChangeEvent, type Ref } from 'react';
import { Download, History, ShieldCheck, TriangleAlert, Upload } from 'lucide-react';
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
import { SETTINGS_COPY, formatDate, formatDateTime, type Announce } from '../model/notice';
import { Panel } from './Panel';

type Busy = 'export' | 'import' | 'restore' | null;
type PendingImport = { save: Save; migratedFrom: number | null };

const BLOCKED_ID = 'settings-storage-blocked';
const RESTORE_HINT_ID = 'settings-restore-hint';

/** Storage status, last export, Export / Import / Restore backup (design.md screen `settings`). */
export function SaveSection({
  blocked,
  loadError,
  announce,
  clearNotice,
  backup,
  onBackupChange,
  exportRef,
}: {
  /** Storage isn't durable: only Export is offered. */
  blocked: boolean;
  /** The stored save couldn't be read (the store is in `error`). */
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
  const [busy, setBusy] = useState<Busy>(null);
  const [justExportedAt, setJustExportedAt] = useState<number | null>(null);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const persistent = !blocked && persist === 'persisted';
  const storageKnown = blocked || persist !== 'unknown';

  async function onExport() {
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

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // picking the same file again still fires change
    if (!file) return;
    setBusy('import');
    announce(SETTINGS_COPY.importing, 'info');
    const result = await readSaveFile(file);
    setBusy(null);
    if (!result.ok) {
      announce(result.error === 'newer' ? TRANSFER_COPY.newer : TRANSFER_COPY.damaged, 'error');
      return;
    }
    clearNotice();
    setPending({ save: result.save, migratedFrom: result.migratedFrom });
  }

  async function onConfirmImport() {
    if (!pending) return;
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

      {blocked && (
        <p id={BLOCKED_ID} className="mt-4 text-sm text-muted-foreground">
          {SETTINGS_COPY.blocked}
        </p>
      )}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
        <Button
          ref={exportRef}
          onClick={onExport}
          disabled={!hasSave || busy !== null}
          className="cursor-pointer justify-center"
        >
          <Download aria-hidden className="size-4" />
          Export save
        </Button>

        <Button
          variant="outline"
          onClick={() => fileRef.current?.click()}
          disabled={blocked || busy !== null}
          aria-describedby={blocked ? BLOCKED_ID : undefined}
          aria-busy={busy === 'import' || undefined}
          className="cursor-pointer justify-center"
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

        <div className="flex flex-col gap-1.5">
          <Button
            variant="outline"
            onClick={onRestore}
            disabled={!backup || blocked || busy !== null}
            aria-describedby={joinIds(RESTORE_HINT_ID, blocked && BLOCKED_ID)}
            className="cursor-pointer justify-center"
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
        onClose={() => setPending(null)}
        title="Replace current progress?"
        description="Your current save moves to the backup slot."
        footer={
          <>
            <Button variant="ghost" onClick={() => setPending(null)} className="cursor-pointer">
              Cancel
            </Button>
            <Button onClick={onConfirmImport} disabled={busy !== null} className="cursor-pointer">
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
