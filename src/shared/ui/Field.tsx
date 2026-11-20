import { useEffect, useId, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

type FieldShellProps = {
  label: string;
  hint?: ReactNode;
  error?: string;
  htmlFor: string;
  hintId: string;
  children: ReactNode;
};

/** Label + control + hint/error line. Shared by text inputs and the combobox. */
export function FieldShell({ label, hint, error, htmlFor, hintId, children }: FieldShellProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className="text-[12px] font-semibold tracking-[0.08em] text-ink-300 uppercase">
        {label}
      </label>
      {children}
      <p id={hintId} className={cn('min-h-[1.25rem] text-[13px] leading-snug', error ? 'text-danger' : 'text-ink-400')}>
        {/* Keyed spans replay a soft entrance whenever the message changes. */}
        {error ? (
          <span key={error} className="err-in inline-block">
            {error}
          </span>
        ) : (
          <span key={typeof hint === 'string' ? hint : 'hint'} className="hint-in inline-block">
            {hint}
          </span>
        )}
      </p>
    </div>
  );
}

/**
 * Shakes a control whenever a new error message appears (never on mount).
 * Alternating the attribute value swaps the keyframe name, which restarts the
 * animation without remounting the input — so focus is preserved.
 */
export function useShake(error?: string): { 'data-shake'?: 'a' | 'b' } {
  const prevError = useRef(error);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (error && error !== prevError.current) setCount((c) => c + 1);
    prevError.current = error;
  }, [error]);

  return { 'data-shake': count === 0 ? undefined : count % 2 ? 'a' : 'b' };
}

export const controlClass = (invalid: boolean) =>
  cn(
    'flex w-full items-center gap-2 rounded-xl border bg-ink-900/70 px-3.5 transition-colors',
    'focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/15',
    invalid ? 'border-danger/70' : 'border-white/10 hover:border-white/20',
  );

type TextFieldProps = ComponentProps<'input'> & {
  label: string;
  hint?: string;
  error?: string;
  onClear?: () => void;
  showClear?: boolean;
};

export function TextField({ label, hint, error, onClear, showClear, className, id, ...props }: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = `${inputId}-hint`;
  const shake = useShake(error);

  return (
    <FieldShell label={label} hint={hint} error={error} htmlFor={inputId} hintId={hintId}>
      <div className={cn(controlClass(Boolean(error)), 'h-12')} {...shake}>
        <input
          id={inputId}
          aria-invalid={Boolean(error)}
          aria-describedby={hintId}
          autoComplete="off"
          className={cn(
            'h-full w-full bg-transparent text-[15px] text-white outline-none placeholder:text-ink-500',
            className,
          )}
          {...props}
        />
        {showClear && onClear && (
          <button
            type="button"
            onClick={onClear}
            aria-label={`Clear ${label.toLowerCase()}`}
            className="rounded-md p-1 text-ink-400 transition-colors hover:bg-white/8 hover:text-white"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    </FieldShell>
  );
}
