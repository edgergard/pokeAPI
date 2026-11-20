import { useEffect, useRef, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { prefersReducedMotion } from '@/shared/lib/motion';

type Props = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
};

/** Safety net if `animationend` never fires for the exit (e.g. the tab is hidden). */
const EXIT_FALLBACK_MS = 300;

/** Native <dialog>: focus trapping, Esc handling and top-layer rendering come for free. */
export function Dialog({ open, onClose, title, description, children, footer, className }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  // `mounted` outlives `open` by the exit animation; derived during render so content never blinks.
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);
  const closing = !open && mounted;

  // Callers usually null their props on close; keep the last open content for the exit animation.
  const snapshot = useRef({ title, description, children, footer });
  if (open) snapshot.current = { title, description, children, footer };
  const content = open ? { title, description, children, footer } : snapshot.current;

  const finish = () => {
    ref.current?.close();
    setMounted(false);
  };

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;

    if (open) {
      if (!dialog.open) dialog.showModal();
      return;
    }
    if (!dialog.open) {
      setMounted(false);
      return;
    }

    if (prefersReducedMotion()) {
      dialog.close();
      setMounted(false);
      return;
    }
    const timer = setTimeout(() => {
      dialog.close();
      setMounted(false);
    }, EXIT_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [open]);

  return (
    <dialog
      ref={ref}
      data-closing={closing || undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget && event.animationName === 'dialog-out') finish();
      }}
      className={cn(
        'dialog m-auto max-h-[calc(100dvh-2rem)] w-[min(640px,calc(100vw-2rem))] overflow-hidden rounded-3xl border border-white/10 bg-ink-900 p-0 text-white shadow-2xl',
        className,
      )}
    >
      {(open || mounted) && (
        // Inert while closing: the snapshot's buttons keep stale handlers, and pointer-events alone doesn't stop keys.
        <div inert={closing} className="flex max-h-[calc(100dvh-2rem)] flex-col">
          <header className="flex items-start justify-between gap-4 border-b border-white/8 px-6 pt-6 pb-5">
            <div className="min-w-0">
              <h2 className="font-display text-2xl font-bold tracking-tight">{content.title}</h2>
              {content.description && <p className="mt-1 text-sm text-ink-400">{content.description}</p>}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="-mr-2 rounded-lg p-2 text-ink-400 transition-colors hover:bg-white/8 hover:text-white"
            >
              <X className="size-5" />
            </button>
          </header>
          <div className="overflow-y-auto px-6 py-5">{content.children}</div>
          {content.footer && (
            <footer className="flex flex-col-reverse gap-3 border-t border-white/8 px-6 py-4 sm:flex-row sm:justify-end">
              {content.footer}
            </footer>
          )}
        </div>
      )}
    </dialog>
  );
}
