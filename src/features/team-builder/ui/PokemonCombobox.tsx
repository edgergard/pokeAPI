import {
  useCallback,
  useDeferredValue,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import { searchPokemon, spriteUrl, usePokemonIndex } from '@/entities/pokemon';
import { cn } from '@/shared/lib/cn';
import { formatDexNumber, formatName } from '@/shared/lib/format';
import { DUR, EASE, prefersReducedMotion, usePrefersReducedMotion } from '@/shared/lib/motion';
import { usePresence } from '@/shared/lib/usePresence';
import { FieldShell, controlClass, useShake } from '@/shared/ui/Field';
import { Spinner } from '@/shared/ui/Spinner';
import { Button } from '@/shared/ui/Button';

type Props = {
  value: string[];
  onChange: (value: string[]) => void;
  onBlur?: () => void;
  max: number;
  error?: string;
};

/** Chip exit: one --dur-sm fade per chip plus a 40ms right-to-left cascade across up to four. */
const CHIP_EXIT_MS = DUR.sm + 3 * 40;
/** How long freshly opened options keep their entrance cascade. */
const OPENING_MS = 400;
/** Row height fallback (px) until the first option is measured. */
const DEFAULT_ROW_H = 48;
/** Chips still playing their exit keep their CSS transform; a WAAPI glide would override it. */
const FLIP_SELECTOR = '[data-flip-key]:not([data-leaving])';

/** Multi-select autocomplete following the WAI-ARIA combobox pattern. */
export function PokemonCombobox({ value, onChange, onBlur, max, error }: Props) {
  const inputId = useId();
  const listId = `${inputId}-list`;
  const hintId = `${inputId}-hint`;
  const inputRef = useRef<HTMLInputElement>(null);
  const controlRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const { data: index = [], isPending, isError, refetch } = usePokemonIndex();

  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const deferredQuery = useDeferredValue(query);

  const idByName = useMemo(() => new Map(index.map((p) => [p.name, p.id])), [index]);
  const results = useMemo(
    () => searchPokemon(index, deferredQuery, { exclude: value }),
    [index, deferredQuery, value],
  );

  const isFull = value.length >= max;
  const remaining = max - value.length;
  const showList = open && query.trim().length > 0 && !isFull;
  const activeOption = results[activeIndex];
  const shake = useShake(error);

  /* ---------- Chip motion: sprite fly-in, exit presence, sibling FLIP ---------- */

  const reduced = usePrefersReducedMotion();
  const chipEls = useRef(new Map<string, HTMLSpanElement>());
  const flyRef = useRef<{ name: string; rect: DOMRect } | null>(null);
  const flipRects = useRef(new Map<string, DOMRect>());

  const recordFlipRects = useCallback(() => {
    const control = controlRef.current;
    if (!control) return;
    control.querySelectorAll<HTMLElement>(FLIP_SELECTOR).forEach((el) => {
      flipRects.current.set(el.dataset.flipKey ?? '', el.getBoundingClientRect());
    });
  }, []);

  const chips = usePresence(value, reduced ? 0 : CHIP_EXIT_MS, recordFlipRects);
  const renderedKeys = chips.map((chip) => chip.key).join('|');

  // The picked option's sprite arcs from the list into its new chip.
  useLayoutEffect(() => {
    const fly = flyRef.current;
    flyRef.current = null;
    if (!fly || prefersReducedMotion()) return;
    const chip = chipEls.current.get(fly.name);
    const img = chip?.querySelector('img');
    if (!chip || !img) return;

    const to = img.getBoundingClientRect();
    if (to.width === 0 || chip.offsetWidth === 0) return;
    // The chip is mid-pop (scaled), and the sprite's transform is applied inside that scale.
    const k = chip.getBoundingClientRect().width / chip.offsetWidth || 1;
    const dx = (fly.rect.left + fly.rect.width / 2 - (to.left + to.width / 2)) / k;
    const dy = (fly.rect.top + fly.rect.height / 2 - (to.top + to.height / 2)) / k;
    const s = fly.rect.width / to.width;

    // Lift the sprite above its neighbours only while it is in flight.
    const land = () => {
      img.style.position = '';
      img.style.zIndex = '';
    };
    img.style.position = 'relative';
    img.style.zIndex = '30';
    img
      .animate(
        [
          { transform: `translate(${dx}px, ${dy}px) scale(${s})` },
          {
            transform: `translate(${dx / 2}px, ${dy / 2 - 40}px) scale(${(s + 1.15) / 2})`,
            offset: 0.5,
          },
          { transform: 'none' },
        ],
        { duration: DUR.lg, easing: EASE.standard },
      )
      .finished.then(land, land);
  }, [value]);

  // Once leaving chips are dropped, the survivors glide into their new spots.
  useLayoutEffect(() => {
    const control = controlRef.current;
    const rects = flipRects.current;
    if (!control || rects.size === 0) return;
    if (!prefersReducedMotion()) {
      control.querySelectorAll<HTMLElement>(FLIP_SELECTOR).forEach((el) => {
        const before = rects.get(el.dataset.flipKey ?? '');
        if (!before) return;
        const after = el.getBoundingClientRect();
        const dx = before.left - after.left;
        const dy = before.top - after.top;
        if (dx === 0 && dy === 0) return;
        el.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], {
          duration: DUR.md,
          easing: EASE.standard,
        });
      });
    }
    rects.clear();
  }, [renderedKeys]);

  /* ---------- Listbox motion: option cascade on open, gliding highlight ---------- */

  const [opening, setOpening] = useState(false);
  const wasShowing = useRef(false);
  useLayoutEffect(() => {
    const justOpened = showList && !wasShowing.current;
    wasShowing.current = showList;
    if (!justOpened) return;
    setOpening(true);
    const timer = setTimeout(() => setOpening(false), OPENING_MS);
    return () => clearTimeout(timer);
  }, [showList]);

  const [rowH, setRowH] = useState(DEFAULT_ROW_H);
  useLayoutEffect(() => {
    const first = listRef.current?.querySelector<HTMLElement>('[role="option"]');
    if (first && first.offsetHeight > 0 && first.offsetHeight !== rowH) setRowH(first.offsetHeight);
  }, [showList, results, rowH]);

  /* ---------- Selection ---------- */

  const select = (name: string, sourceImg?: HTMLImageElement | null) => {
    if (isFull || value.includes(name)) return;
    if (sourceImg) flyRef.current = { name, rect: sourceImg.getBoundingClientRect() };
    onChange([...value, name]);
    setQuery('');
    setActiveIndex(0);
    inputRef.current?.focus();
  };

  // The pressed button is about to go inert (or unmount), and with a full team the input isn't
  // rendered yet, so focus moves only after the commit that brings the input back.
  const focusInputNext = useRef(false);
  useLayoutEffect(() => {
    if (!focusInputNext.current || !inputRef.current) return;
    focusInputNext.current = false;
    inputRef.current.focus();
  }, [value]);

  // Filling the last slot unmounts the focused input; hand focus to the newest chip's remove button
  // so keyboard and screen-reader users keep their place (the next Tab reaches "Review team").
  const wasFull = useRef(isFull);
  useLayoutEffect(() => {
    const becameFull = isFull && !wasFull.current;
    wasFull.current = isFull;
    if (!becameFull || document.activeElement !== document.body) return;
    const last = value[value.length - 1];
    const button = last
      ? chipEls.current.get(last)?.querySelector<HTMLButtonElement>('button')
      : null;
    button?.focus();
  }, [isFull, value]);

  // Keep the keyboard-highlighted option visible inside the scrolling listbox.
  useLayoutEffect(() => {
    if (!showList || !activeOption) return;
    document.getElementById(`${listId}-${activeOption.name}`)?.scrollIntoView({ block: 'nearest' });
  }, [showList, activeOption, listId]);

  const remove = (name: string) => {
    focusInputNext.current = true;
    onChange(value.filter((n) => n !== name));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setOpen(true);
        setActiveIndex((i) => Math.min(i + 1, results.length - 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        // Never submit the form from the search box.
        event.preventDefault();
        if (showList && activeOption)
          select(
            activeOption.name,
            document.getElementById(`${listId}-${activeOption.name}`)?.querySelector('img'),
          );
        break;
      case 'Escape':
        if (showList) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
        }
        break;
      case 'Backspace':
        if (!query && value.length) onChange(value.slice(0, -1));
        break;
    }
  };

  const hint = isError
    ? undefined
    : isFull
      ? 'Your team is complete.'
      : `Pick ${remaining} more to continue.`;

  return (
    <FieldShell
      label="Your team"
      htmlFor={inputId}
      hintId={hintId}
      error={isError ? 'Couldn’t load the Pokédex.' : error}
      hint={hint}
    >
      <div className="relative">
        <div
          ref={controlRef}
          className={cn(controlClass(Boolean(error)), 'min-h-12 flex-wrap py-2 pr-2 pl-2')}
          onClick={() => inputRef.current?.focus()}
          {...shake}
        >
          {chips.map(({ key: name, leaving, exitIndex }) => (
            <span
              key={name}
              ref={(el) => {
                if (el) chipEls.current.set(name, el);
                else chipEls.current.delete(name);
              }}
              data-flip-key={name}
              data-leaving={leaving || undefined}
              aria-hidden={leaving || undefined}
              inert={leaving}
              style={leaving ? ({ '--i': exitIndex } as CSSProperties) : undefined}
              className={cn(
                'chip relative flex h-8 items-center gap-1 rounded-lg border border-white/10 bg-white/6 pr-1 pl-0.5 text-sm font-medium',
                leaving ? 'pointer-events-none' : 'chip-enter',
              )}
            >
              <span
                aria-hidden
                className="chip-shine pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
              />
              {idByName.has(name) && (
                <img
                  src={spriteUrl(idByName.get(name)!)}
                  alt=""
                  className="size-7 [image-rendering:pixelated]"
                />
              )}
              {formatName(name)}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  remove(name);
                }}
                aria-label={`Remove ${formatName(name)}`}
                className="rounded-md p-0.5 text-ink-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="size-3.5" />
              </button>
            </span>
          ))}

          {!isFull && (
            <div
              data-flip-key="input"
              className="flex min-w-[10rem] flex-1 items-center gap-2 pl-1.5"
            >
              {value.length === 0 && <Search className="size-4 shrink-0 text-ink-500" />}
              <input
                ref={inputRef}
                id={inputId}
                role="combobox"
                aria-expanded={showList}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={
                  showList && activeOption ? `${listId}-${activeOption.name}` : undefined
                }
                aria-describedby={hintId}
                aria-invalid={Boolean(error)}
                autoComplete="off"
                spellCheck={false}
                disabled={isPending || isError}
                value={query}
                placeholder={
                  isPending
                    ? 'Loading Pokédex…'
                    : value.length
                      ? 'Add another…'
                      : 'Search by name, e.g. pikachu'
                }
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(0);
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onBlur={() => {
                  setOpen(false);
                  onBlur?.();
                }}
                onKeyDown={onKeyDown}
                className="h-8 w-full bg-transparent text-[15px] text-white outline-none placeholder:text-ink-500 disabled:cursor-wait"
              />
            </div>
          )}

          <div className="ml-auto flex items-center gap-1 pl-1">
            {isPending && <Spinner className="size-4" />}
            {isError && (
              <Button
                variant="ghost"
                size="md"
                className="h-8 px-2 text-xs"
                onClick={() => refetch()}
              >
                Retry
              </Button>
            )}
            {value.length > 0 ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  focusInputNext.current = true;
                  onChange([]);
                }}
                aria-label="Clear team"
                className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-white/8 hover:text-white"
              >
                <X className="size-4" />
              </button>
            ) : (
              !isPending && <ChevronDown className="mx-1.5 size-4 text-ink-500" />
            )}
          </div>
        </div>

        {showList && (
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label="Matching Pokémon"
            data-opening={opening || undefined}
            style={
              { '--row-h': `${rowH}px`, '--active-y': `${activeIndex * rowH}px` } as CSSProperties
            }
            className="dropdown-enter listbox-pill absolute inset-x-0 top-full z-20 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-white/10 bg-ink-850/95 p-1.5 shadow-2xl backdrop-blur-xl"
          >
            {results.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-ink-400">
                No Pokémon match “{query.trim()}”
              </li>
            ) : (
              results.map((pokemon, i) => (
                <li
                  key={pokemon.name}
                  id={`${listId}-${pokemon.name}`}
                  role="option"
                  aria-selected={i === activeIndex}
                  style={{ '--i': Math.min(i, 8) } as CSSProperties}
                  // Keep focus in the input so blur doesn't close the list before click lands.
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={(e) => select(pokemon.name, e.currentTarget.querySelector('img'))}
                  className={cn(
                    'relative z-[1] flex cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 text-sm transition-colors',
                    i === activeIndex ? 'text-white' : 'text-ink-200',
                  )}
                >
                  <img
                    src={spriteUrl(pokemon.id)}
                    alt=""
                    loading="lazy"
                    className="size-9 [image-rendering:pixelated]"
                    onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
                  />
                  <span className="flex-1 font-medium">{formatName(pokemon.name)}</span>
                  <span className="font-mono text-xs text-ink-500">
                    {formatDexNumber(pokemon.id)}
                  </span>
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      {/* Slot indicator: bars charge as picks land, then a sweep runs across when the team is complete. */}
      <div
        className="mt-1 flex gap-1.5"
        aria-hidden
        data-complete={value.length === max || undefined}
      >
        {Array.from({ length: max }, (_, i) => (
          <span
            key={i}
            style={{ '--i': i } as CSSProperties}
            className="relative h-1 flex-1 overflow-hidden rounded-full bg-white/8"
          >
            <span
              className="slot-fill absolute inset-0 rounded-full bg-accent"
              data-filled={i < value.length || undefined}
            />
          </span>
        ))}
      </div>
    </FieldShell>
  );
}
