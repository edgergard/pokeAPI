import { useDeferredValue, useId, useMemo, useState, type RefObject } from 'react';
import { Search, Sparkles } from 'lucide-react';
import { RARITY_LABEL, RARITY_TEXT_CLASS, craftPrice } from '@/entities/capsule';
import { allSpecies, typeColor, type Species } from '@/entities/pokemon';
import type { OwnedPokemon } from '@/entities/save';
import { cn } from '@/shared/lib/cn';
import { formatDexNumber } from '@/shared/lib/format';
import { Button } from '@/shared/ui/Button';
import { CreatureArt } from '@/widgets/capsule-reveal';

/** Rows shown at first and added per "Show more". */
const PAGE = 24;

type Props = {
  dust: number;
  collection: Record<string, OwnedPokemon>;
  onCraft: (speciesId: number) => void;
  /** Focus lands back here after a craft (the crafted row leaves the list). */
  searchRef: RefObject<HTMLInputElement | null>;
};

function matches(species: Species, query: string): boolean {
  if (!query) return true;
  const number = Number(query.replace(/^#/, ''));
  if (Number.isInteger(number) && number > 0) return species.id === number;
  return species.name.toLowerCase().includes(query) || species.slug.includes(query);
}

/** "Buy a specific Pokémon": a filterable list of unowned species with their dust price. */
export function CraftList({ dust, collection, onCraft, searchRef }: Props) {
  const headingId = useId();
  const inputId = useId();
  const countId = useId();
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const deferred = useDeferredValue(query.trim().toLowerCase());

  const unowned = useMemo(
    () => allSpecies.filter((s) => collection[String(s.id)] === undefined),
    [collection],
  );
  const found = useMemo(() => unowned.filter((s) => matches(s, deferred)), [unowned, deferred]);
  const shown = found.slice(0, limit);

  return (
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-4 rounded-3xl p-5 glass sm:p-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 id={headingId} className="font-display text-xl font-bold tracking-tight">
            Buy a specific Pokémon
          </h2>
          <p className="text-sm text-muted-foreground">
            Craft any Pokémon you don&apos;t own yet with dust. The price depends on its rarity.
          </p>
        </div>
        <DustBalance dust={dust} />
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor={inputId}
          className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase"
        >
          Search unowned Pokémon
        </label>
        <div className="flex h-12 items-center gap-2 rounded-xl border border-input bg-muted px-3.5 focus-within:border-ring focus-within:ring-4 focus-within:ring-ring/15">
          <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={searchRef}
            id={inputId}
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE);
            }}
            placeholder="Name or number"
            autoComplete="off"
            aria-describedby={countId}
            className="h-full w-full bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
          />
        </div>
        <p id={countId} aria-live="polite" className="text-xs text-muted-foreground">
          {found.length === 0
            ? 'No unowned Pokémon match this search'
            : `Showing ${shown.length} of ${found.length} unowned Pokémon`}
        </p>
      </div>

      {shown.length > 0 && (
        <ul aria-labelledby={headingId} className="flex flex-col gap-2">
          {shown.map((species) => (
            <CraftRow key={species.id} species={species} dust={dust} onCraft={onCraft} />
          ))}
        </ul>
      )}

      {found.length > shown.length && (
        <Button
          variant="outline"
          size="lg"
          onClick={() => setLimit((l) => l + PAGE)}
          className="cursor-pointer self-center"
        >
          Show more
        </Button>
      )}
    </section>
  );
}

function CraftRow({
  species,
  dust,
  onCraft,
}: {
  species: Species;
  dust: number;
  onCraft: (speciesId: number) => void;
}) {
  const reasonId = useId();
  const price = craftPrice(species.rarity);
  const missing = Math.max(0, price - dust);
  const affordable = missing === 0;

  return (
    <li
      data-species={species.id}
      className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl bg-muted/70 px-3 py-2"
    >
      <div className="relative size-12 shrink-0">
        <CreatureArt
          speciesId={species.id}
          name={species.name}
          color={typeColor(species.types[0])}
          kind="sprite"
          className="size-full [image-rendering:pixelated]"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate font-semibold text-foreground">{species.name}</span>
        <span className="text-xs text-muted-foreground">
          <span className={cn('font-semibold', RARITY_TEXT_CLASS[species.rarity])}>
            {RARITY_LABEL[species.rarity]}
          </span>
          {' · '}
          {formatDexNumber(species.id)}
        </span>
      </div>
      <div className="flex items-center gap-3 max-sm:w-full max-sm:justify-between">
        <span className="font-mono text-sm text-foreground">{price} dust</span>
        <div className="flex flex-col items-end gap-0.5">
          <Button
            variant={affordable ? 'primary' : 'outline'}
            onClick={() => {
              if (affordable) onCraft(species.id);
            }}
            aria-disabled={!affordable || undefined}
            aria-describedby={affordable ? undefined : reasonId}
            aria-label={`Craft with dust: ${species.name}`}
            className={cn(
              'h-11 justify-center',
              affordable
                ? 'cursor-pointer'
                : 'cursor-not-allowed opacity-60 shadow-none hover:border-white/12 hover:bg-transparent',
            )}
          >
            Craft with dust
          </Button>
          {!affordable && (
            <span id={reasonId} className="text-xs text-muted-foreground">
              Need {missing} more dust
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

export function DustBalance({ dust }: { dust: number }) {
  return (
    <p className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-muted px-4 font-mono text-sm text-foreground">
      <Sparkles aria-hidden className="size-4 text-primary" />
      <span className="sr-only">Dust balance:</span>
      {dust} dust
    </p>
  );
}
