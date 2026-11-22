import { useCallback, useEffect, useState } from 'react';
import { readBackup, type SaveBackup } from '@/entities/save';

/**
 * The backup slot for display: `undefined` while reading, `null` when empty.
 * `refresh()` re-reads it after an import, restore or reset.
 */
export function useBackupInfo(enabled: boolean): {
  backup: SaveBackup | null | undefined;
  refresh: () => void;
} {
  const [backup, setBackup] = useState<SaveBackup | null | undefined>(undefined);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void readBackup().then((next) => {
      if (live) setBackup(next);
    });
    return () => {
      live = false;
    };
  }, [enabled, version]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  return { backup, refresh };
}
