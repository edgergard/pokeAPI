import { useId, type ChangeEvent, type ReactNode, type Ref } from 'react';
import { ChevronDown } from 'lucide-react';
import { RARITY_LABEL } from '@/entities/capsule';
import { PokemonSearch } from '@/features/pokemon-search';
import { RARITIES } from '@/shared/config/economy';
import { cn } from '@/shared/lib/cn';
import { formatName } from '@/shared/lib/format';
import {
  OWNERSHIP_OPTIONS,
  SORT_OPTIONS,
  SPECIES_GENERATIONS,
  SPECIES_TYPES,
  isPokemonType,
  isRarity,
  searchModeFor,
  type CollectionFilters as Filters,
  type SortKey,
} from '../model/filters';

type Props = {
  filters: Filters;
  sort: SortKey;
  onFiltersChange: (next: Filters) => void;
  onSortChange: (sort: SortKey) => void;
  searchRef: Ref<HTMLInputElement>;
};

const isSortKey = (value: string): value is SortKey => SORT_OPTIONS.some((o) => o.value === value);

/** Native filter controls (design.md `collection`): owned/missing, type, rarity, generation, sort, search. */
export function CollectionFilters({
  filters,
  sort,
  onFiltersChange,
  onSortChange,
  searchRef,
}: Props) {
  const ownershipName = useId();
  const set = (patch: Partial<Filters>) => onFiltersChange({ ...filters, ...patch });

  return (
    <section
      aria-label="Filters"
      className="relative z-20 flex flex-col gap-4 rounded-3xl p-4 glass sm:p-5"
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <PokemonSearch
          variant="filter"
          mode={searchModeFor(filters.ownership)}
          label="Search"
          hint="Name or dex number"
          query={filters.query}
          onQueryChange={(query) => set({ query })}
          inputRef={searchRef}
        />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
            Show
          </legend>
          <div className="flex h-12 rounded-xl border border-input bg-muted p-1">
            {OWNERSHIP_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={cn(
                  'relative flex min-w-20 flex-1 cursor-pointer items-center justify-center rounded-lg px-3 text-sm font-semibold transition-colors',
                  'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring',
                  filters.ownership === option.value
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-secondary',
                )}
              >
                <input
                  type="radio"
                  name={ownershipName}
                  value={option.value}
                  checked={filters.ownership === option.value}
                  onChange={() => set({ ownership: option.value })}
                  className="sr-only"
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SelectField
          label="Type"
          value={filters.type}
          onChange={(e) => {
            const value = e.target.value;
            set({ type: isPokemonType(value) ? value : 'all' });
          }}
        >
          <option value="all">All types</option>
          {SPECIES_TYPES.map((type) => (
            <option key={type} value={type}>
              {formatName(type)}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Rarity"
          value={filters.rarity}
          onChange={(e) => {
            const value = e.target.value;
            set({ rarity: isRarity(value) ? value : 'all' });
          }}
        >
          <option value="all">All rarities</option>
          {RARITIES.map((rarity) => (
            <option key={rarity} value={rarity}>
              {RARITY_LABEL[rarity]}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Generation"
          value={String(filters.generation)}
          onChange={(e) => {
            const value = Number(e.target.value);
            set({ generation: SPECIES_GENERATIONS.includes(value) ? value : 'all' });
          }}
        >
          <option value="all">All generations</option>
          {SPECIES_GENERATIONS.map((gen) => (
            <option key={gen} value={gen}>
              Generation {gen}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Sort by"
          value={sort}
          onChange={(e) => {
            const value = e.target.value;
            if (isSortKey(value)) onSortChange(value);
          }}
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectField>
      </div>
    </section>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label
        htmlFor={id}
        className="text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase"
      >
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={onChange}
          className="h-12 w-full cursor-pointer appearance-none rounded-xl border border-input bg-muted pr-9 pl-3.5 text-sm text-foreground transition-colors hover:border-foreground focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
      </div>
    </div>
  );
}
