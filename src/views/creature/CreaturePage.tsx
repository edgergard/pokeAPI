'use client';

import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  getPokemonTalent,
  learnPokemonTalent,
  nextPokemonTalentPointLevel,
  resetPokemonTalents,
  talentPointsAvailable,
} from '@/entities/progression';
import type { RevealResult } from '@/entities/capsule';
import { SPECIES_COUNT, type Species } from '@/entities/pokemon';
import { getSave, updateSave, useSave, useSaveStatus, type OwnedPokemon } from '@/entities/save';
import { useCraft } from '@/features/open-capsule';
import { ownedSpeciesCount } from '@/features/pokemon-search';
import { formatDexNumber } from '@/shared/lib/format';
import { useHydrated } from '@/shared/lib/useHydrated';
import { CapsuleReveal } from '@/widgets/capsule-reveal';
import { TalentTree } from '@/widgets/talent-tree';
import {
  BRANCH_GROUPS,
  addToTeam,
  creatureHref,
  neighbours,
  parseCreatureId,
  pokemonTalentNodes,
  statChanges,
  talentPointNote,
  teamStatus,
  type CreatureQuery,
} from './model/creature';
import { CraftPanel } from './ui/CraftPanel';
import { HoloCard } from './ui/HoloCard';
import { LevelPanel } from './ui/LevelPanel';
import { Moves } from './ui/Moves';
import { StatsTable } from './ui/StatsTable';
import { TeamAction } from './ui/TeamAction';

/** After the dialog's exit (300 ms fallback) so the native focus restore has already happened. */
const FOCUS_AFTER_CLOSE_MS = 350;

const headingClass =
  'font-display text-4xl leading-tight font-extrabold tracking-tight outline-none sm:text-5xl';

const pillLinkClass =
  'inline-flex h-11 min-w-0 items-center gap-1.5 rounded-2xl border border-border bg-secondary px-3.5 text-sm font-medium text-secondary-foreground transition-colors hover:border-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

/** Creature screen (design.md `creature`, route `/creature/?id=N`): grow one Pokémon, or craft it. */
export function CreaturePage() {
  // `?id` exists only in the browser: read it after hydration, never during prerender.
  const hydrated = useHydrated();
  return (
    <main id="content" className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-4 py-8 sm:py-12">
      {hydrated ? <CreatureWithQuery /> : <CreatureSkeleton />}
    </main>
  );
}

/** Rendered only after hydration, so useSearchParams never runs during prerender (no Suspense needed). */
function CreatureWithQuery() {
  const query = parseCreatureId(useSearchParams().get('id'));
  const { status } = useSaveStatus();
  if (query.kind !== 'species') return <NotFound query={query} />;
  if (status === 'loading') return <CreatureSkeleton name={query.species.name} />;
  return <CreatureContent species={query.species} saveFailed={status === 'error'} />;
}

type Announcement = { text: string; n: number };

function CreatureContent({ species, saveFailed }: { species: Species; saveFailed: boolean }) {
  const key = String(species.id);
  const owned = useSave((s) => s.collection[key]);
  const dust = useSave((s) => s.dust);
  const team = useSave((s) => teamStatus(s, species.id));
  // Same count as the Collection screen: baked species only, never above SPECIES_COUNT.
  const ownedTotal = useSave((s) => ownedSpeciesCount(s.collection));
  const { craft } = useCraft();

  const headingRef = useRef<HTMLHeadingElement>(null);
  const [announcement, setAnnouncement] = useState<Announcement>({ text: '', n: 0 });
  const [reveal, setReveal] = useState<RevealResult[] | null>(null);
  const [revealOpen, setRevealOpen] = useState(false);
  const [craftFailed, setCraftFailed] = useState(false);
  const focusTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(focusTimer.current), []);

  // Prev / next keep this component mounted (and the focused link with it): reset per-species UI instead.
  const [shownId, setShownId] = useState(species.id);
  if (shownId !== species.id) {
    setShownId(species.id);
    setAnnouncement({ text: '', n: 0 });
    setReveal(null);
    setRevealOpen(false);
    setCraftFailed(false);
  }

  const announce = (text: string) => setAnnouncement((a) => ({ text, n: a.n + 1 }));

  /** Applies a talent change to the stored Pokémon and announces the stats it moved. */
  const changeTalents = (
    change: (current: OwnedPokemon) => OwnedPokemon | null,
    message: (stats: string[]) => string,
  ) => {
    const captured: { before?: OwnedPokemon; after?: OwnedPokemon } = {};
    updateSave((save) => {
      const current = save.collection[key];
      const next = current ? change(current) : null;
      if (!current || !next || next === current) return save;
      captured.before = current;
      captured.after = next;
      return { ...save, collection: { ...save.collection, [key]: next } };
    });
    const { before, after } = captured;
    if (before && after)
      announce(message(statChanges(species, after, before.talents, after.talents)));
  };

  const learn = (talentId: string) =>
    changeTalents(
      (current) => {
        const result = learnPokemonTalent(current, talentId);
        return result.ok ? result.owned : null;
      },
      (stats) =>
        stats.length > 0
          ? stats.join(', ')
          : `Learned ${getPokemonTalent(talentId)?.name ?? 'talent'}`,
    );

  const reset = () =>
    changeTalents(resetPokemonTalents, (stats) =>
      stats.length > 0 ? `Talents reset. ${stats.join(', ')}` : 'Talents reset',
    );

  const add = () => {
    const before = getSave()?.team.length ?? 0;
    updateSave((save) => addToTeam(save, species.id));
    if ((getSave()?.team.length ?? 0) > before) announce(`${species.name} joined your team.`);
  };

  const onCraft = () => {
    const out = craft(species.id);
    if (!out.ok) {
      setCraftFailed(true);
      return;
    }
    setCraftFailed(false);
    setReveal([out.result]);
    setRevealOpen(true);
  };

  const closeReveal = () => {
    setRevealOpen(false);
    // The craft button is gone (the species is owned now): land on the heading if focus was lost.
    clearTimeout(focusTimer.current);
    focusTimer.current = setTimeout(() => {
      const active = document.activeElement;
      if (active && active !== document.body && document.contains(active)) return;
      headingRef.current?.focus({ preventScroll: true });
    }, FOCUS_AFTER_CLOSE_MS);
  };

  return (
    <>
      <CreatureHeader
        species={species}
        headingRef={headingRef}
        ownedTotal={ownedTotal ?? 0}
        action={owned && team ? <TeamAction status={team} onAdd={add} /> : null}
      />

      {saveFailed && (
        <p
          role="alert"
          className="rounded-2xl border border-destructive/50 bg-destructive/10 px-4 py-3"
        >
          Your save couldn&apos;t be loaded.{' '}
          <Link
            href="/settings/"
            className="font-semibold text-primary underline underline-offset-4"
          >
            Open Settings
          </Link>
        </p>
      )}

      <p role="status" className="sr-only" data-testid="creature-status">
        {announcement.text && <span key={announcement.n}>{announcement.text}</span>}
      </p>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <div className="mx-auto w-full max-w-sm">
            <HoloCard key={species.id} species={species} owned={owned} />
          </div>
          <Moves key={species.id} species={species} />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {owned ? (
            <>
              <LevelPanel species={species} owned={owned} />
              <StatsTable species={species} owned={owned} />
              <TalentTree
                variant="pokemon"
                title="Talents"
                groups={BRANCH_GROUPS}
                nodes={pokemonTalentNodes(owned)}
                pointsAvailable={talentPointsAvailable(owned)}
                pointsNote={talentPointNote(owned, nextPokemonTalentPointLevel(owned.level))}
                onLearn={learn}
                onReset={reset}
                resetLabel="Reset talents · free"
              />
            </>
          ) : (
            <>
              {dust !== undefined && (
                <CraftPanel species={species} dust={dust} onCraft={onCraft} failed={craftFailed} />
              )}
              <StatsTable species={species} />
            </>
          )}
        </div>
      </div>

      {reveal && (
        <CapsuleReveal
          results={reveal}
          open={revealOpen}
          onClose={closeReveal}
          title="Crafted with dust"
          primaryLabel="Done"
          onPrimary={closeReveal}
        />
      )}
    </>
  );
}

function CreatureHeader({
  species,
  headingRef,
  ownedTotal,
  action,
}: {
  species: Species;
  headingRef: RefObject<HTMLHeadingElement | null>;
  ownedTotal: number;
  action: ReactNode;
}) {
  const { prev, next } = neighbours(species.id);
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <Link
          href="/collection/"
          className="tap-target inline-flex w-fit items-center gap-1.5 rounded-lg text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <ArrowLeft aria-hidden className="size-4" />
          Collection {ownedTotal} / {SPECIES_COUNT}
        </Link>
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h1 ref={headingRef} tabIndex={-1} className={headingClass}>
            {species.name}
          </h1>
          <span className="font-mono text-sm text-muted-foreground">
            {formatDexNumber(species.id)}
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-start gap-2">
        <nav aria-label="Browse Pokémon" className="flex flex-wrap gap-2">
          {prev && (
            <Link
              href={creatureHref(prev.id)}
              aria-label={`Previous: ${formatDexNumber(prev.id)} ${prev.name}`}
              className={pillLinkClass}
            >
              <ChevronLeft aria-hidden className="size-4 shrink-0" />
              <span className="truncate">
                {formatDexNumber(prev.id)} {prev.name}
              </span>
            </Link>
          )}
          {next && (
            <Link
              href={creatureHref(next.id)}
              aria-label={`Next: ${formatDexNumber(next.id)} ${next.name}`}
              className={pillLinkClass}
            >
              <span className="truncate">
                {formatDexNumber(next.id)} {next.name}
              </span>
              <ChevronRight aria-hidden className="size-4 shrink-0" />
            </Link>
          )}
        </nav>
        {action}
      </div>
    </div>
  );
}

function NotFound({ query }: { query: Exclude<CreatureQuery, { kind: 'species' }> }) {
  return (
    <div className="flex flex-col items-start gap-4">
      <h1 className={headingClass}>
        {query.kind === 'invalid' ? `No Pokémon #${query.raw}` : 'No Pokémon selected'}
      </h1>
      <p className="text-muted-foreground">
        Pick one from your collection: every Pokémon from #001 to {formatDexNumber(SPECIES_COUNT)}{' '}
        has a page.
      </p>
      <Link
        href="/collection/"
        className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary px-5 font-semibold text-primary-foreground shadow-glow transition-colors hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <ArrowLeft aria-hidden className="size-4" />
        Go to Collection
      </Link>
    </div>
  );
}

function CreatureSkeleton({ name }: { name?: string }) {
  return (
    <>
      {name ? (
        <h1 className={headingClass}>{name}</h1>
      ) : (
        <>
          <h1 className="sr-only">Pokémon</h1>
          <div
            aria-hidden
            className="shimmer relative h-12 w-64 overflow-hidden rounded-xl bg-card"
          />
        </>
      )}
      <div
        role="status"
        aria-label="Loading Pokémon"
        className="grid gap-5 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]"
      >
        <div className="shimmer relative h-[28rem] overflow-hidden rounded-3xl bg-card" />
        <div className="flex flex-col gap-4">
          <div className="shimmer relative h-28 overflow-hidden rounded-3xl bg-card" />
          <div className="shimmer relative h-64 overflow-hidden rounded-3xl bg-card" />
          <div className="shimmer relative h-72 overflow-hidden rounded-3xl bg-card" />
        </div>
      </div>
    </>
  );
}
