// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { useState } from 'react';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createNewSave, initSave, type OwnedPokemon, type Save } from '@/entities/save';
import { __resetSaveStoreForTests } from '@/entities/save/model/store';
import { PokemonSearch } from './PokemonSearch';

function owned(speciesId: number): OwnedPokemon {
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
  };
}

/** A save owning Pikachu (25) and Charmander (4). */
function testSave(): Save {
  const save = createNewSave({ seed: 1, now: 0, name: 'Test' });
  return { ...save, collection: { '25': owned(25), '4': owned(4) } };
}

async function load(save: Save) {
  await act(() =>
    initSave(
      { durable: true, load: async () => ({ kind: 'loaded', save }), write: async () => true },
      () => save,
    ),
  );
}

const options = () =>
  within(screen.getByRole('listbox', { hidden: true }))
    .queryAllByRole('option', { hidden: true })
    .map((o) => o.textContent ?? '');

function FilterHarness({ onSelect }: { onSelect?: (id: number) => void }) {
  const [query, setQuery] = useState('');
  return (
    <>
      <PokemonSearch
        variant="filter"
        mode="all"
        label="Search"
        query={query}
        onQueryChange={setQuery}
        onSelect={onSelect}
      />
      <output data-testid="query">{query}</output>
    </>
  );
}

describe('PokemonSearch', () => {
  beforeEach(async () => {
    __resetSaveStoreForTests();
    await load(testSave());
  });

  it('is a labelled combobox that opens a listbox of matches while typing', async () => {
    const user = userEvent.setup();
    render(<PokemonSearch variant="pick" mode="all" label="Find" onSelect={() => {}} />);
    const box = screen.getByRole('combobox', { name: 'Find' });
    expect(box).toHaveAttribute('aria-expanded', 'false');
    expect(box).toHaveAttribute('aria-autocomplete', 'list');

    await user.type(box, 'pika');
    expect(box).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox')).toHaveAttribute('id', box.getAttribute('aria-controls'));
    expect(options()[0]).toContain('Pikachu');
    // 'all' mode tags what the player owns.
    expect(screen.getByRole('option', { name: /Pikachu/ })).toHaveTextContent('Owned');
  });

  it('pick mode: highlights the best match, arrows move it, Enter picks and clears', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<PokemonSearch variant="pick" mode="all" label="Find" onSelect={onSelect} />);
    const box = screen.getByRole('combobox');

    await user.type(box, 'char');
    const first = screen.getAllByRole('option')[0];
    expect(first).toHaveAttribute('aria-selected', 'true');
    expect(box).toHaveAttribute('aria-activedescendant', first?.id);

    await user.keyboard('{ArrowDown}');
    const second = screen.getAllByRole('option')[1];
    expect(second).toHaveAttribute('aria-selected', 'true');
    expect(box).toHaveAttribute('aria-activedescendant', second?.id);
    await user.keyboard('{ArrowUp}');
    expect(box).toHaveAttribute('aria-activedescendant', first?.id);

    await user.keyboard('{Enter}');
    expect(onSelect).toHaveBeenCalledWith(4);
    expect(box).toHaveValue('');
    expect(box).toHaveAttribute('aria-expanded', 'false');
  });

  it('Esc closes the list first, then clears the field', async () => {
    const user = userEvent.setup();
    render(<PokemonSearch variant="pick" mode="all" label="Find" onSelect={() => {}} />);
    const box = screen.getByRole('combobox');
    await user.type(box, 'pika');
    await user.keyboard('{Escape}');
    expect(box).toHaveAttribute('aria-expanded', 'false');
    expect(box).toHaveValue('pika');
    await user.keyboard('{Escape}');
    expect(box).toHaveValue('');
  });

  it('owned mode only suggests owned species, unowned mode only missing ones', async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <PokemonSearch variant="pick" mode="owned" label="Owned" onSelect={() => {}} />,
    );
    await user.type(screen.getByRole('combobox'), 'char');
    expect(options()).toHaveLength(1);
    expect(options()[0]).toContain('Charmander');
    unmount();

    render(<PokemonSearch variant="pick" mode="unowned" label="Missing" onSelect={() => {}} />);
    await user.type(screen.getByRole('combobox'), 'char');
    expect(options().some((o) => o.includes('Charmander'))).toBe(false);
    expect(options().some((o) => o.includes('Charmeleon'))).toBe(true);
  });

  it('pick mode says when nothing matches', async () => {
    const user = userEvent.setup();
    render(<PokemonSearch variant="pick" mode="all" label="Find" onSelect={() => {}} />);
    await user.type(screen.getByRole('combobox'), 'zzzz');
    expect(screen.getByText('No Pokémon match “zzzz”')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('No Pokémon found');
  });

  it('filter mode: the query is controlled, Enter keeps the typed text, a pick fills the name', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<FilterHarness onSelect={onSelect} />);
    const box = screen.getByRole('combobox', { name: 'Search' });

    await user.type(box, 'char');
    expect(screen.getByTestId('query')).toHaveTextContent('char');
    // No automatic selection in filter mode: Enter only closes the list.
    expect(box).not.toHaveAttribute('aria-activedescendant');
    await user.keyboard('{Enter}');
    expect(box).toHaveAttribute('aria-expanded', 'false');
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.getByTestId('query')).toHaveTextContent('char');

    await user.keyboard('{ArrowDown}{Enter}');
    expect(onSelect).toHaveBeenCalledWith(4);
    expect(screen.getByTestId('query')).toHaveTextContent('Charmander');
  });

  it('picks with the mouse too', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(<PokemonSearch variant="pick" mode="all" label="Find" onSelect={onSelect} />);
    await user.type(screen.getByRole('combobox'), 'pikachu');
    await user.click(screen.getByRole('option', { name: /Pikachu/ }));
    expect(onSelect).toHaveBeenCalledWith(25);
  });
});
