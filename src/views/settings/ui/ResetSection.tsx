import { useRef, useState, type FormEvent } from 'react';
import { RotateCcw } from 'lucide-react';
import { TRANSFER_COPY, resetProgress } from '@/features/save-transfer';
import { cn } from '@/shared/lib/cn';
import { TextField } from '@/shared/ui/Field';
import { SETTINGS_COPY, type Announce, type SaveLock } from '../model/notice';
import { Panel } from './Panel';
import { unavailableClass } from './unavailable';

const CONFIRM_WORD = 'RESET';

/**
 * "Reset progress" with type-to-confirm: the button arms only when the field reads exactly RESET.
 * Unarmed it stays focusable (`aria-disabled`) and ignores presses.
 */
export function ResetSection({
  lock,
  unreadable,
  announce,
  onDone,
}: {
  /** Why resetting is off right now (storage blocked, newer save, another tab), or null. */
  lock: SaveLock | null;
  /** The stored save can't be read: it is replaced without a backup. */
  unreadable: boolean;
  announce: Announce;
  /** After a reset: refresh the backup info and move focus somewhere useful. */
  onDone: () => void;
}) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const locked = lock !== null;
  const armed = value === CONFIRM_WORD && !locked && !busy;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!armed || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const ok = await resetProgress();
    busyRef.current = false;
    setBusy(false);
    if (!ok) {
      announce(TRANSFER_COPY.backupFailed, 'error');
      return;
    }
    setValue('');
    announce(SETTINGS_COPY.reset, 'success', { homeLink: true });
    onDone();
  }

  return (
    <Panel
      id="reset"
      title="Reset progress"
      description={unreadable ? SETTINGS_COPY.resetUnreadable : SETTINGS_COPY.resetKeepsBackup}
    >
      <form onSubmit={onSubmit} className="flex flex-col items-start gap-2">
        <div className="w-full sm:max-w-xs">
          <TextField
            label={`Type ${CONFIRM_WORD} to confirm`}
            hint={lock ? lock.reason : `Letters must match: ${CONFIRM_WORD}`}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            disabled={locked}
            autoCapitalize="characters"
            spellCheck={false}
          />
        </div>
        <button
          type="submit"
          aria-disabled={!armed || undefined}
          className={cn(
            'inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-all duration-150 max-sm:h-11',
            'border-destructive/60 text-destructive hover:border-destructive hover:bg-destructive/10',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
            'active:scale-[0.98]',
            unavailableClass,
            'aria-disabled:hover:border-destructive/60 aria-disabled:hover:bg-transparent',
          )}
        >
          <RotateCcw aria-hidden className="size-4" />
          Reset progress
        </button>
      </form>
    </Panel>
  );
}
