'use client';

import { useRef, useState, type ChangeEvent } from 'react';
import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import { LOAD_ERROR_NEWER } from '@/entities/save';
import {
  TRANSFER_COPY,
  applyImport,
  readSaveFile,
  resetProgress,
  restoreBackup,
} from '@/features/save-transfer';
import { Button } from '@/shared/ui/Button';
import { textLink } from './styles';

type Announce = (text: string) => void;

/** Home-only results of the rescue actions (the import/backup wording comes from TRANSFER_COPY). */
export const RESCUE_COPY = {
  restored: 'Backup restored',
  noBackup: 'No backup yet',
  fresh: 'A new save has started',
  confirm: 'Start over from the first card? Your current save can’t be read and will be replaced.',
} as const;

/**
 * Home's error state (the stored save can't be read): Restore backup, Import file or Start fresh
 * (after a confirmation). A save from a newer game version is never overwritten from here.
 */
export function SaveRescue({ error, announce }: { error: string | null; announce: Announce }) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const busyRef = useRef(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const newer = error === LOAD_ERROR_NEWER;

  const run = async (action: () => Promise<string | null>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const message = await action();
      if (message) announce(message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const restore = () =>
    run(async () => {
      const result = await restoreBackup();
      if (result === 'restored') return RESCUE_COPY.restored;
      if (result === 'empty') return RESCUE_COPY.noBackup;
      return TRANSFER_COPY.backupFailed;
    });

  const importFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    void run(async () => {
      const decoded = await readSaveFile(file);
      if (!decoded.ok) return TRANSFER_COPY[decoded.error];
      if (!(await applyImport(decoded.save))) return TRANSFER_COPY.backupFailed;
      return decoded.migratedFrom !== null
        ? `${TRANSFER_COPY.imported}. ${TRANSFER_COPY.upgraded(decoded.migratedFrom)}`
        : TRANSFER_COPY.imported;
    });
  };

  const startFresh = () =>
    run(async () => {
      setConfirming(false);
      return (await resetProgress()) ? RESCUE_COPY.fresh : TRANSFER_COPY.backupFailed;
    });

  return (
    <section
      aria-labelledby="rescue-title"
      aria-busy={busy || undefined}
      className="flex w-full max-w-xl flex-col gap-5 rounded-3xl border border-destructive/40 p-6 glass"
    >
      <div className="flex items-start gap-3">
        <TriangleAlert aria-hidden className="mt-1 size-5 shrink-0 text-destructive" />
        <div className="flex flex-col gap-1">
          <h2 id="rescue-title" className="font-display text-xl font-bold tracking-tight">
            Your save couldn’t be loaded
          </h2>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>

      {newer ? (
        <Link href="/settings/" className={textLink}>
          Open Settings
        </Link>
      ) : confirming ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-foreground">{RESCUE_COPY.confirm}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={startFresh}
              aria-disabled={busy || undefined}
              className="cursor-pointer bg-destructive text-background hover:bg-destructive/85"
            >
              Start fresh
            </Button>
            <Button
              variant="outline"
              onClick={() => setConfirming(false)}
              className="cursor-pointer"
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button onClick={restore} aria-disabled={busy || undefined} className="cursor-pointer">
            Restore backup
          </Button>
          <Button
            variant="outline"
            onClick={() => fileRef.current?.click()}
            aria-disabled={busy || undefined}
            className="cursor-pointer"
          >
            Import file
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".txt,text/plain"
            onChange={importFile}
            className="sr-only"
            tabIndex={-1}
            aria-label="Save file to import"
          />
          <Button variant="ghost" onClick={() => setConfirming(true)} className="cursor-pointer">
            Start fresh
          </Button>
        </div>
      )}
    </section>
  );
}
