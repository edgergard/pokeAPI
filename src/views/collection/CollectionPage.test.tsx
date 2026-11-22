// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { craftPrice } from '@/entities/capsule';
import { SPECIES_COUNT, getSpecies } from '@/entities/pokemon';
import { createNewSave, initSave, type OwnedPokemon, type Save } from '@/entities/save';
import { __resetSaveStoreForTests } from '@/entities/save/model/store';
import { CollectionPage } from './CollectionPage';

function owned(speciesId: number, patch: Partial<OwnedPokemon> = {}): OwnedPokemon {
  return {
    speciesId,
    level: 1,
    xp: 0,
    stars: 1,
    dupes: 0,
    ivs: { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
    nature: 'neutral',
    talents: [],
    obtainedAt: 0,
    ...patch,
  };
}

/** Owns Pikachu Lv 12 ★2 (2 unspent talent points), Charmander Lv 3 and Mewtwo Lv 30. */
function testSave(): Save {
  const save = createNewSave({ seed: 1, now: 0, name: 'Test' });
  return {
    ...save,
    dust: 77,
    collection: {
      '25': owned(25, { level: 12, stars: 2 }),
      '4': owned(4, { level: 3 }),
      '150': owned(150, { level: 30, stars: 4 }),
    },
  };
}

async function load(save: Save) {
  await act(() =>
    initSave(
      { durable: true, load: async () => ({ kind: 'loaded', save }), write: async () => true },
      () => save,
    ),
  );
}

const grid = () => screen.getByRole('list', { name: 'Pokémon' });
const tileLinks = () => within(grid()).getAllByRole('link');

describe('CollectionPage', () => {
  beforeEach(() => {
    vi.stubEnv('__NEXT_TRAILING_SLASH', 'true');
    __resetSaveStoreForTests();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders one h1 and a shimmer while the save loads', () => {
    render(<CollectionPage />);
    expect(screen.getByRole('main')).toHaveAttribute('id', 'content');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Collection');
    expect(screen.getByRole('status', { name: 'Loading collection' })).toBeInTheDocument();
  });

  it('shows the collection count with a progressbar and the dust chip', async () => {
    render(<CollectionPage />);
    await load(testSave());
    expect(screen.getByText(`Collection 3 / ${SPECIES_COUNT}`)).toBeInTheDocument();
    const bar = screen.getByRole('progressbar', { name: `Collection 3 / ${SPECIES_COUNT}` });
    expect(bar).toHaveAttribute('aria-valuenow', '3');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', String(SPECIES_COUNT));
    expect(screen.getByText('77 dust')).toBeInTheDocument();
  });

  it('lists owned tiles and missing silhouettes as named links to the creature page', async () => {
    render(<CollectionPage />);
    await load(testSave());
    const pikachu = screen.getByRole('link', { name: 'Pikachu, level 12, 2 stars' });
    expect(pikachu).toHaveAttribute('href', '/creature/?id=25');
    // The talent-point dot is described in text, not by the dot alone.
    expect(pikachu).toHaveAccessibleDescription(/Talent point to spend/);
    expect(pikachu.closest('li')?.querySelector('[data-testid="talent-dot"]')).not.toBeNull();

    const charmander = screen.getByRole('link', { name: 'Charmander, level 3, 1 star' });
    expect(charmander.closest('li')?.querySelector('[data-testid="talent-dot"]')).toBeNull();

    const bulbasaur = screen.getByRole('link', { name: 'Missing: Bulbasaur' });
    expect(bulbasaur).toHaveAttribute('href', '/creature/?id=1');
    const price = craftPrice(getSpecies(1)?.rarity ?? 'common');
    expect(bulbasaur.closest('li')).toHaveTextContent(`Craft · ${price} dust`);
    expect(bulbasaur).toHaveAccessibleDescription(new RegExp(`Craft · ${price} dust`));
  });

  it('pages the grid: never all 1025 tiles at once, "Show more" adds a page and moves focus', async () => {
    const user = userEvent.setup();
    render(<CollectionPage />);
    await load(testSave());
    const first = tileLinks().length;
    expect(first).toBeLessThan(SPECIES_COUNT);
    expect(grid().querySelectorAll('img').length).toBe(first);
    expect(screen.getByTestId('collection-summary')).toHaveTextContent(
      `Showing ${first} of ${SPECIES_COUNT} Pokémon`,
    );
    await user.click(screen.getByRole('button', { name: 'Show more' }));
    expect(tileLinks()).toHaveLength(first * 2);
    expect(tileLinks()[first]).toHaveFocus();
  });

  it('filters owned / missing with native radios', async () => {
    const user = userEvent.setup();
    render(<CollectionPage />);
    await load(testSave());
    await user.click(screen.getByRole('radio', { name: 'Owned' }));
    expect(tileLinks().map((a) => a.getAttribute('href'))).toEqual([
      '/creature/?id=4',
      '/creature/?id=25',
      '/creature/?id=150',
    ]);
    await user.click(screen.getByRole('radio', { name: 'Missing' }));
    expect(screen.queryByRole('link', { name: /^Pikachu/ })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Missing: Bulbasaur' })).toBeInTheDocument();
  });

  it('filters by type, rarity and generation', async () => {
    const user = userEvent.setup();
    render(<CollectionPage />);
    await load(testSave());
    await user.selectOptions(screen.getByRole('combobox', { name: 'Type' }), 'fire');
    expect(screen.getByRole('link', { name: 'Charmander, level 3, 1 star' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Missing: Bulbasaur' })).not.toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', { name: 'Generation' }), '1');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Rarity' }), 'common');
    const ids = tileLinks().map((a) => Number(a.getAttribute('href')?.split('=')[1]));
    expect(ids.length).toBeGreaterThan(0);
    for (const id of ids) {
      const s = getSpecies(id);
      expect(s?.types).toContain('fire');
      expect(s?.generation).toBe(1);
      expect(s?.rarity).toBe('common');
    }
  });

  it('sorts by level and by rarity', async () => {
    const user = userEvent.setup();
    render(<CollectionPage />);
    await load(testSave());
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'level');
    expect(
      tileLinks()
        .slice(0, 3)
        .map((a) => a.getAttribute('aria-label')),
    ).toEqual([
      'Mewtwo, level 30, 4 stars',
      'Pikachu, level 12, 2 stars',
      'Charmander, level 3, 1 star',
    ]);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Sort by' }), 'rarity');
    const firstId = Number(tileLinks()[0]?.getAttribute('href')?.split('=')[1]);
    expect(getSpecies(firstId)?.rarity).toBe('legendary');
  });

  it('searches through PokemonSearch in filter mode', async () => {
    const user = userEvent.setup();
    render(<CollectionPage />);
    await load(testSave());
    await user.type(screen.getByRole('combobox', { name: 'Search' }), 'pikach');
    expect(tileLinks().map((a) => a.getAttribute('aria-label'))).toEqual([
      'Pikachu, level 12, 2 stars',
    ]);
  });

  it('announces the real result count from the summary, not from the search box', async () => {
    const user = userEvent.setup();
    render(<CollectionPage />);
    await load(testSave());
    const summary = screen.getByTestId('collection-summary');
    expect(summary).toHaveAttribute('role', 'status');
    expect(summary).toHaveAttribute('aria-live', 'polite');
    expect(summary).toHaveAttribute('tabindex', '-1');

    await user.selectOptions(screen.getByRole('combobox', { name: 'Type' }), 'water');
    expect(summary).toHaveTextContent(/^Showing [0-9]+ of [0-9]+ Pokémon$/);
    await user.type(screen.getByRole('combobox', { name: 'Search' }), 'char');
    // Charmander & co. match the search but not the type: the grid is empty and the summary says so,
    // while the search box only mentions its suggestions.
    expect(summary).toHaveTextContent('No Pokémon shown');
    const statuses = screen.getAllByRole('status').map((s) => s.textContent ?? '');
    expect(statuses.some((t) => /found/.test(t))).toBe(false);
    expect(statuses.some((t) => /suggestions?$/.test(t))).toBe(true);
  });

  it('shows the empty state and "Clear filters" resets every filter', async () => {
    const user = userEvent.setup();
    render(<CollectionPage />);
    await load(testSave());
    await user.click(screen.getByRole('radio', { name: 'Owned' }));
    await user.type(screen.getByRole('combobox', { name: 'Search' }), 'bulba');
    expect(screen.getByText('No Pokémon match these filters')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Pokémon' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(screen.queryByText('No Pokémon match these filters')).not.toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'All' })).toBeChecked();
    expect(screen.getByRole('combobox', { name: 'Search' })).toHaveValue('');
    expect(screen.getByTestId('collection-summary')).toHaveFocus();
    expect(screen.getByTestId('collection-summary')).toHaveTextContent(`of ${SPECIES_COUNT}`);
  });
});
