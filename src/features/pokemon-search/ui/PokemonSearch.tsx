'use client';

import {
  useCallback,
  useDeferredValue,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type Ref,
} from 'react';
import { Search, X } from 'lucide-react';
import { getCreatureArt } from '@/entities/pokemon';
import { useSave, type Save } from '@/entities/save';
import { cn } from '@/shared/lib/cn';
import { formatDexNumber } from '@/shared/lib/format';
import { FieldShell, controlClass } from '@/shared/ui/Field';
import { inSearchMode, searchSpecies, type SearchMode } from '../model/search';

/** Suggestions shown at once (UI constant): keep typing to narrow the rest. */
const MAX_OPTIONS = 8;

const EMPTY_COLLECTION: Save['collection'] = {};

/** Writes an element into a caller's ref, callback or object. */
function assignRef<T>(ref: Ref<T> | undefined, value: T | null): void {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}

const popupClass =
  'absolute inset-x-0 top-full z-30 mt-2 max-h-80 overflow-y-auto rounded-2xl border border-border bg-popover p-1.5 shadow-2xl';

type CommonProps = {
  /** owned = in the save's collection, unowned = missing from it, all = every species. */
  mode: SearchMode;
  label: string;
  hint?: string;
  placeholder?: string;
  id?: string;
  inputRef?: Ref<HTMLInputElement>;
  className?: string;
};

type FilterProps = CommonProps & {
  /**
   * Filter mode: the query is controlled and the caller filters its own list by it
   * (`matchesSpeciesQuery`). Picking a suggestion fills the query with that species' name.
   */
  variant: 'filter';
  query: string;
  onQueryChange: (query: string) => void;
  onSelect?: (speciesId: number) => void;
};

type PickProps = CommonProps & {
  /** Pick mode: choosing a suggestion calls `onSelect` and clears the field for the next pick. */
  variant: 'pick';
  onSelect: (speciesId: number) => void;
  /** Species ids never offered (e.g. already picked). */
  exclude?: readonly number[];
};

export type PokemonSearchProps = FilterProps | PickProps;

/**
 * Accessible species search over the baked `allSpecies` (WAI-ARIA combobox with list autocomplete):
 * arrows move through suggestions, Enter picks, Esc closes the list and then clears the field.
 * Filter mode has no automatic selection (Enter keeps the typed text); pick mode highlights the best match.
 */
export function PokemonSearch(props: PokemonSearchProps) {
  const { mode, label, hint, placeholder = 'Name or number', id, inputRef, className } = props;
  const autoId = useId();
  const inputId = id ?? autoId;
  const listId = `${inputId}-list`;
  const hintId = `${inputId}-hint`;

  const collection = useSave((s) => s.collection) ?? EMPTY_COLLECTION;
  const [ownQuery, setOwnQuery] = useState('');
  const query = props.variant === 'filter' ? props.query : ownQuery;
  const setQuery = props.variant === 'filter' ? props.onQueryChange : setOwnQuery;
  const autoSelect = props.variant === 'pick';
  const exclude = props.variant === 'pick' ? props.exclude : undefined;

  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  // Our own handle on the input (focus after "Clear search"), shared with the caller's ref.
  const ownInputRef = useRef<HTMLInputElement | null>(null);
  const setInputRef = useCallback(
    (element: HTMLInputElement | null) => {
      ownInputRef.current = element;
      assignRef(inputRef, element);
    },
    [inputRef],
  );
  const deferredQuery = useDeferredValue(query);

  const matches = useMemo(
    () => searchSpecies(deferredQuery, { mode, collection, exclude }),
    [deferredQuery, mode, collection, exclude],
  );
  const options = matches.slice(0, MAX_OPTIONS);
  const showList = open && query.trim().length > 0;
  const expanded = showList && options.length > 0;
  const active = expanded ? options[activeIndex] : undefined;
  const optionId = (speciesId: number) => `${listId}-${speciesId}`;
  const activeId = active ? optionId(active.id) : undefined;

  // Keep the highlighted suggestion visible inside the scrolling list.
  useLayoutEffect(() => {
    if (activeId) document.getElementById(activeId)?.scrollIntoView?.({ block: 'nearest' });
  }, [activeId]);

  const select = (speciesId: number, name: string) => {
    if (props.variant === 'filter') {
      props.onQueryChange(name);
      props.onSelect?.(speciesId);
    } else {
      setOwnQuery('');
      props.onSelect(speciesId);
    }
    setOpen(false);
    setActiveIndex(-1);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        setOpen(true);
        setActiveIndex((i) => (expanded ? Math.min(i + 1, options.length - 1) : 0));
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        setOpen(true);
        setActiveIndex((i) => (expanded ? Math.max(i - 1, 0) : options.length - 1));
        break;
      }
      case 'Enter': {
        // Never submit a surrounding form from the search box.
        event.preventDefault();
        if (active) select(active.id, active.name);
        else setOpen(false);
        break;
      }
      case 'Escape': {
        if (expanded) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          setActiveIndex(-1);
        } else if (query) {
          event.preventDefault();
          event.stopPropagation();
          setQuery('');
        }
        break;
      }
    }
  };

  // Filter mode: the caller's list owns the real result count (it applies more filters than the
  // search does), so the combobox only talks about its own suggestions.
  const status = !showList
    ? ''
    : props.variant === 'filter'
      ? options.length === 0
        ? ''
        : `${options.length} ${options.length === 1 ? 'suggestion' : 'suggestions'}`
      : matches.length === 0
        ? 'No Pokémon found'
        : matches.length > options.length
          ? `${matches.length} Pokémon found, showing the first ${options.length}`
          : `${matches.length} Pokémon found`;

  return (
    <div className={className}>
      <FieldShell label={label} hint={hint} htmlFor={inputId} hintId={hintId}>
        <div className="relative">
          <div className={cn(controlClass(false), 'h-12 border-input')}>
            <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
            <input
              ref={setInputRef}
              id={inputId}
              type="text"
              role="combobox"
              aria-expanded={expanded}
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={activeId}
              aria-describedby={hintId}
              autoComplete="off"
              spellCheck={false}
              enterKeyHint="search"
              value={query}
              placeholder={placeholder}
              onChange={(event) => {
                setQuery(event.target.value);
                setOpen(true);
                setActiveIndex(autoSelect ? 0 : -1);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => {
                setOpen(false);
                setActiveIndex(-1);
              }}
              onKeyDown={onKeyDown}
              className="h-full w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  setActiveIndex(-1);
                  // The button unmounts with the text: keep focus in the field instead of <body>.
                  ownInputRef.current?.focus();
                }}
                aria-label="Clear search"
                className="tap-target grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <X aria-hidden className="size-4" />
              </button>
            )}
          </div>

          <ul
            id={listId}
            role="listbox"
            aria-label={`${label} suggestions`}
            hidden={!expanded}
            className={popupClass}
          >
            {options.map((species, i) => {
              const selected = i === activeIndex;
              const owned = mode === 'all' && inSearchMode(collection, species.id, 'owned');
              return (
                <li
                  key={species.id}
                  id={optionId(species.id)}
                  role="option"
                  aria-selected={selected}
                  // Keep focus in the input so its blur doesn't close the list before the click lands.
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(i)}
                  onClick={() => select(species.id, species.name)}
                  className={cn(
                    'flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 py-1 text-sm text-popover-foreground',
                    selected && 'bg-secondary ring-1 ring-ring',
                  )}
                >
                  <img
                    src={getCreatureArt(species.id, 'sprite')}
                    alt=""
                    loading="lazy"
                    onError={(event) => (event.currentTarget.style.visibility = 'hidden')}
                    className="size-9 shrink-0 [image-rendering:pixelated]"
                  />
                  <span className="flex-1 font-medium">{species.name}</span>
                  {owned && (
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-foreground">
                      Owned
                    </span>
                  )}
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatDexNumber(species.id)}
                  </span>
                </li>
              );
            })}
          </ul>
          {/* Filter mode: the caller's own list shows its empty state instead. */}
          {props.variant === 'pick' && showList && options.length === 0 && (
            <p className={cn(popupClass, 'px-3 py-5 text-center text-sm text-muted-foreground')}>
              No Pokémon match “{query.trim()}”
            </p>
          )}
          <p role="status" className="sr-only">
            {status}
          </p>
        </div>
      </FieldShell>
    </div>
  );
}
