import { useState, type FormEvent } from 'react';
import { RotateCcw } from 'lucide-react';
import { TRANSFER_COPY, resetProgress } from '@/features/save-transfer';
import { cn } from '@/shared/lib/cn';
import { TextField } from '@/shared/ui/Field';
import { SETTINGS_COPY, type Announce } from '../model/notice';
import { Panel } from './Panel';

const CONFIRM_WORD = 'RESET';

/** "Reset progress" with type-to-confirm: the button arms only when the field reads exactly RESET. */
export function ResetSection({
  blocked,
  announce,
  onDone,
}: {
  blocked: boolean;
  announce: Announce;
  /** After a reset: refresh the backup info and move focus somewhere useful. */
  onDone: () => void;
}) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const armed = value === CONFIRM_WORD && !blocked && !busy;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!armed) return;
    setBusy(true);
    const ok = await resetProgress();
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
      description="Start over from the first card. Your current save moves to the backup slot."
    >
      <form onSubmit={onSubmit} className="flex flex-col items-start gap-2">
        <div className="w-full sm:max-w-xs">
          <TextField
            label={`Type ${CONFIRM_WORD} to confirm`}
            hint={blocked ? SETTINGS_COPY.blocked : `Letters must match: ${CONFIRM_WORD}`}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            disabled={blocked}
            autoCapitalize="characters"
            spellCheck={false}
          />
        </div>
        <button
          type="submit"
          disabled={!armed}
          className={cn(
            'inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-all duration-150 max-sm:h-11',
            'border-destructive/60 text-destructive hover:border-destructive hover:bg-destructive/10',
            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
            'active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100',
          )}
        >
          <RotateCcw aria-hidden className="size-4" />
          Reset progress
        </button>
      </form>
    </Panel>
  );
}
