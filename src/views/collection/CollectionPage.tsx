'use client';

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { allSpecies, SPECIES_COUNT } from '@/entities/pokemon';
import { useSave, useSaveStatus } from '@/entities/save';
import { ownedSpeciesCount } from '@/features/pokemon-search';
import { Button } from '@/shared/ui/Button';
import {
  DEFAULT_FILTERS,
  filterSpecies,
  hasActiveFilters,
  sortSpecies,
  type CollectionFilters as Filters,
  type SortKey,
} from './model/filters';
import { CollectionFilters } from './ui/CollectionFilters';
import { MissingTile, OwnedTile, TileSkeleton } from './ui/CollectionTile';

/** Tiles per "Show more" (UI constant, divisible by every column count: 2, 3, 4, 6). */
const PAGE_SIZE = 48;

const gridClass = 'grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6';

/** Collection screen (design.md `collection`): the Pokédex of owned and missing species. */
export function CollectionPage() {
  const { status } = useSaveStatus();
  return (
    <main id="content" className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:py-14">
      <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
        Collection
      </h1>
      {status === 'ready' ? (
        <CollectionContent />
      ) : status === 'loading' ? (
        <CollectionSkeleton />
      ) : (
        <SaveUnavailable />
      )}
    </main>
  );
}

function CollectionContent() {
  const collection = useSave((s) => s.collection);
  const dust = useSave((s) => s.dust);
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<SortKey>('dex');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const deferredFilters = useDeferredValue(filters);
  const searchRef = useRef<HTMLInputElement>(null);
  const summaryRef = useRef<HTMLParagraphElement>(null);
  const gridRef = useRef<HTMLUListElement>(null);
  // Index of the first tile a "Show more" added: it takes focus once rendered.
  const focusTile = useRef<number | null>(null);

  const matching = useMemo(
    () =>
      collection
        ? sortSpecies(filterSpecies(allSpecies, collection, deferredFilters), collection, sort)
        : [],
    [collection, deferredFilters, sort],
  );
  const owned = useMemo(() => (collection ? ownedSpeciesCount(collection) : 0), [collection]);

  useEffect(() => {
    const index = focusTile.current;
    if (index === null) return;
    focusTile.current = null;
    gridRef.current?.querySelectorAll<HTMLAnchorElement>('li > div > a')[index]?.focus();
  }, [limit]);

  if (!collection || dust === undefined) return null;

  const shown = matching.slice(0, limit);
  const filtered = hasActiveFilters(filters);

  const changeFilters = (next: Filters) => {
    setFilters(next);
    setLimit(PAGE_SIZE);
  };

  const clearFilters = () => {
    changeFilters(DEFAULT_FILTERS);
    // The button that was pressed may disappear with the empty state: land on the new count.
    summaryRef.current?.focus();
  };

  return (
    <>
      <CollectionProgress owned={owned} dust={dust} />

      <CollectionFilters
        filters={filters}
        sort={sort}
        onFiltersChange={changeFilters}
        onSortChange={(next) => {
          setSort(next);
          setLimit(PAGE_SIZE);
        }}
        searchRef={searchRef}
      />

      <section aria-labelledby="collection-grid-heading" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="collection-grid-heading" className="sr-only">
            Pokémon
          </h2>
          {/* Live: filter, sort and search changes (down to zero) are announced; also the focus target
              after "Clear filters". */}
          <p
            ref={summaryRef}
            tabIndex={-1}
            role="status"
            aria-live="polite"
            className="text-sm text-muted-foreground outline-none"
            data-testid="collection-summary"
          >
            {matching.length === 0
              ? 'No Pokémon shown'
              : `Showing ${shown.length} of ${matching.length} Pokémon`}
          </p>
          {filtered && matching.length > 0 && (
            <Button variant="outline" onClick={clearFilters} className="cursor-pointer">
              Clear filters
            </Button>
          )}
        </div>

        {matching.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-3xl px-6 py-12 text-center glass">
            <p className="text-lg text-foreground">No Pokémon match these filters</p>
            <Button size="lg" onClick={clearFilters} className="cursor-pointer">
              Clear filters
            </Button>
          </div>
        ) : (
          <ul ref={gridRef} aria-label="Pokémon" className={gridClass}>
            {shown.map((species) => {
              const own = collection[String(species.id)];
              return own ? (
                <OwnedTile key={species.id} species={species} owned={own} />
              ) : (
                <MissingTile key={species.id} species={species} />
              );
            })}
          </ul>
        )}

        {matching.length > shown.length && (
          <Button
            variant="outline"
            size="lg"
            onClick={() => {
              focusTile.current = shown.length;
              setLimit((l) => l + PAGE_SIZE);
            }}
            className="cursor-pointer self-center"
          >
            Show more
          </Button>
        )}
      </section>
    </>
  );
}

function CollectionProgress({ owned, dust }: { owned: number; dust: number }) {
  const percent = Math.round((owned / SPECIES_COUNT) * 100);
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-60 flex-1 flex-col gap-2">
        <p className="font-display text-xl font-bold" id="collection-progress-label">
          Collection {owned} / {SPECIES_COUNT}
        </p>
        <div
          role="progressbar"
          aria-labelledby="collection-progress-label"
          aria-valuemin={0}
          aria-valuemax={SPECIES_COUNT}
          aria-valuenow={owned}
          aria-valuetext={`${owned} of ${SPECIES_COUNT} Pokémon, ${percent}%`}
          className="h-2.5 w-full max-w-xl overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full rounded-full bg-rarity-rare transition-[width] duration-500"
            style={{ width: `${(owned / SPECIES_COUNT) * 100}%` }}
          />
        </div>
      </div>
      <p className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-muted px-4 font-mono text-sm text-foreground">
        <Sparkles aria-hidden className="size-4 text-primary" />
        <span className="sr-only">Dust balance:</span>
        {dust} dust
      </p>
    </div>
  );
}

function CollectionSkeleton() {
  return (
    <div role="status" aria-label="Loading collection" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="shimmer relative h-7 w-56 overflow-hidden rounded-lg bg-card" />
        <div className="shimmer relative h-2.5 w-full max-w-xl overflow-hidden rounded-full bg-card" />
      </div>
      <div className="shimmer relative h-44 overflow-hidden rounded-3xl bg-card" />
      <ul className={gridClass}>
        {Array.from({ length: 12 }, (_, i) => (
          <TileSkeleton key={i} />
        ))}
      </ul>
    </div>
  );
}

function SaveUnavailable() {
  return (
    <div role="alert" className="flex flex-col items-start gap-4 rounded-3xl p-6 glass">
      <p className="text-foreground">
        Your save couldn&apos;t be loaded, so your collection is hidden.
      </p>
      <Link
        href="/settings/"
        className="inline-flex h-12 items-center rounded-xl bg-primary px-5 font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        Open Settings
      </Link>
    </div>
  );
}
