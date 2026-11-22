import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, ScrollText } from 'lucide-react';
import { cn } from '@/shared/lib/cn';

/** Lines arriving faster than this are announced together, so screen readers keep up at ×2. */
const ANNOUNCE_MS = 1200;

/**
 * The text battle log: a collapsible visible list, plus an always-present polite live region
 * that announces new lines in throttled batches (collapsing the panel never silences it).
 */
export function BattleLog({
  lines,
  defaultOpen = false,
}: {
  lines: string[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();
  const listRef = useRef<HTMLOListElement>(null);
  const announcements = useAnnouncements(lines);

  // Keep the newest line in view while the panel is open.
  useEffect(() => {
    const list = listRef.current;
    if (open && list) list.scrollTop = list.scrollHeight;
  }, [lines.length, open]);

  return (
    <section className="rounded-2xl border border-white/10 bg-ink-900/70" aria-label="Battle log">
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-2 rounded-2xl px-4 py-3 text-left text-sm font-semibold text-ink-100 transition-colors hover:bg-white/4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <ScrollText className="size-4 text-ink-300" aria-hidden />
          Battle log
          <span className="font-mono text-xs font-normal text-ink-400 tabular-nums">
            {lines.length}
          </span>
          <span
            className="ml-auto min-w-0 truncate pl-3 text-xs font-normal text-ink-300 max-sm:hidden"
            aria-hidden
          >
            {!open && lines.at(-1)}
          </span>
          <ChevronDown
            className={cn(
              'size-4 shrink-0 text-ink-300 transition-transform',
              open && 'rotate-180',
            )}
            aria-hidden
          />
        </button>
      </h2>

      <div id={panelId} hidden={!open}>
        <ol
          ref={listRef}
          className="max-h-56 overflow-y-auto border-t border-white/8 px-4 py-3 text-sm leading-relaxed text-ink-200"
        >
          {lines.length === 0 && <li className="text-ink-400">The battle is about to begin…</li>}
          {lines.map((line, i) => (
            <li key={i} className="py-0.5">
              {line}
            </li>
          ))}
        </ol>
      </div>

      <div className="sr-only" aria-live="polite" aria-relevant="additions">
        {announcements.map((a) => (
          <p key={a.id}>{a.text}</p>
        ))}
      </div>
    </section>
  );
}

type Announcement = { id: number; text: string };

/** Batches new log lines into at most one live-region addition per ANNOUNCE_MS. */
function useAnnouncements(lines: string[]): Announcement[] {
  const [items, setItems] = useState<Announcement[]>([]);
  const sent = useRef(0);
  const nextId = useRef(1);
  const timer = useRef<number | null>(null);
  const latest = useRef(lines);
  latest.current = lines;

  useEffect(() => {
    // The log restarted (Replay): start announcing from the top again.
    if (lines.length < sent.current) {
      sent.current = 0;
      setItems([]);
    }
    if (lines.length === sent.current || timer.current !== null) return;
    const flush = () => {
      const all = latest.current;
      const fresh = all.slice(sent.current);
      sent.current = all.length;
      const id = nextId.current++;
      // Only the last few batches stay in the DOM; announced text is never re-read.
      setItems((prev) => [...prev, { id, text: fresh.join(' ') }].slice(-4));
    };
    // Leading edge now, then one batch per window while lines keep arriving.
    const schedule = () => {
      timer.current = window.setTimeout(() => {
        timer.current = null;
        if (latest.current.length > sent.current) {
          flush();
          schedule();
        }
      }, ANNOUNCE_MS);
    };
    flush();
    schedule();
  }, [lines]);

  useEffect(
    () => () => {
      if (timer.current !== null) window.clearTimeout(timer.current);
      timer.current = null;
    },
    [],
  );

  return items;
}
