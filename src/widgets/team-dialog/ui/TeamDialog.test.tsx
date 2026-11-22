// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { strongestTeam } from '@/entities/ladder';
import { polyfillDom } from '@/entities/ladder/testing/testDom';
import { makeOwned, makeSave } from '@/entities/ladder/testing/testSave';
import { getSave, initSave, type Save } from '@/entities/save';
import { __resetSaveStoreForTests } from '@/entities/save/model/store';
import { TeamDialog } from './TeamDialog';

const flags = vi.hoisted(() => ({ failUpdates: false }));
vi.mock('@/entities/save', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/entities/save')>();
  return {
    ...actual,
    updateSave: (fn: (save: Save) => Save) => {
      if (flags.failUpdates) throw new Error('write failed');
      actual.updateSave(fn);
    },
  };
});

beforeAll(polyfillDom);

const PIKACHU = 25;
const BULBASAUR = 1;
const CHARMANDER = 4;
const SQUIRTLE = 7;

async function load(save: Save) {
  await act(() =>
    initSave(
      { durable: true, load: async () => ({ kind: 'loaded', save }), write: async () => true },
      () => save,
    ),
  );
}

const slotButtons = () =>
  within(screen.getByRole('region', { name: 'Team slots' }))
    .getAllByRole('button')
    .filter((b) => b.dataset.slotState === 'filled');

const slotNames = () => slotButtons().map((b) => b.getAttribute('aria-label'));

describe('TeamDialog', () => {
  beforeEach(() => {
    vi.stubEnv('__NEXT_TRAILING_SLASH', 'true');
    __resetSaveStoreForTests();
    flags.failUpdates = false;
  });
  afterEach(() => vi.unstubAllEnvs());

  it('opens on the slots of the trainer level, with locked slots and their unlock level', async () => {
    await load(makeSave({ owned: [makeOwned(PIKACHU, { level: 4 })], trainer: { level: 1 } }));
    render(<TeamDialog open onClose={() => {}} />);
    expect(screen.getByRole('heading', { name: 'Team' })).toBeInTheDocument();
    expect(screen.getByText('1 / 1')).toBeInTheDocument();
    const locked = screen.getByRole('button', { name: 'Slot 2, unlocks at Trainer level 3' });
    expect(locked).toHaveAttribute('aria-disabled', 'true');
    expect(locked).toHaveTextContent('Unlocks at Trainer Lv 3');
    expect(
      screen.getByRole('button', { name: 'Slot 3, unlocks at Trainer level 5' }),
    ).toHaveAttribute('aria-disabled', 'true');
    expect(slotNames()).toEqual(['Slot 1: Pikachu, level 4, 1 star']);
    expect(screen.getByRole('link', { name: 'Open capsules to grow your roster' })).toHaveAttribute(
      'href',
      '/capsules/',
    );
  });

  it('shows empty open slots and fills the first one with a tapped Pokémon', async () => {
    await load(
      makeSave({
        owned: [makeOwned(PIKACHU), makeOwned(BULBASAUR), makeOwned(CHARMANDER)],
        team: [PIKACHU],
        trainer: { level: 5 },
      }),
    );
    render(<TeamDialog open onClose={() => {}} />);
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
    expect(screen.getAllByText('Tap a Pokémon below')).toHaveLength(2);
    expect(screen.queryByText('Open capsules to grow your roster')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Bulbasaur/ }));
    expect(screen.getByText('2 / 3')).toBeInTheDocument();
    expect(slotNames()).toEqual([
      'Slot 1: Pikachu, level 1, 1 star',
      'Slot 2: Bulbasaur, level 1, 1 star',
    ]);
    expect(screen.getByRole('button', { name: /^Bulbasaur/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('status')).toHaveTextContent('Bulbasaur added to slot 2.');
  });

  it('swaps slots with Alt + arrow keys and announces it', async () => {
    await load(
      makeSave({
        owned: [makeOwned(PIKACHU), makeOwned(BULBASAUR)],
        team: [PIKACHU, BULBASAUR],
        trainer: { level: 3 },
      }),
    );
    render(<TeamDialog open onClose={() => {}} />);
    const first = slotButtons()[0];
    if (!first) throw new Error('no slot');
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight', altKey: true });
    expect(slotNames()).toEqual([
      'Slot 1: Bulbasaur, level 1, 1 star',
      'Slot 2: Pikachu, level 1, 1 star',
    ]);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Pikachu moved to slot 2 of 2. Bulbasaur is now in slot 1.',
    );
    // Focus follows the moved Pokémon.
    expect(document.activeElement).toBe(slotButtons()[1]);

    fireEvent.keyDown(slotButtons()[1] as HTMLElement, { key: 'ArrowRight', altKey: true });
    expect(screen.getByRole('status')).toHaveTextContent('Pikachu is already in the last slot.');
    // Plain arrows do nothing.
    fireEvent.keyDown(slotButtons()[0] as HTMLElement, { key: 'ArrowRight' });
    expect(slotNames()[0]).toBe('Slot 1: Bulbasaur, level 1, 1 star');
  });

  it('swaps two slots tapped one after the other', async () => {
    await load(
      makeSave({
        owned: [makeOwned(PIKACHU), makeOwned(BULBASAUR), makeOwned(CHARMANDER)],
        team: [PIKACHU, BULBASAUR, CHARMANDER],
        trainer: { level: 5 },
      }),
    );
    render(<TeamDialog open onClose={() => {}} />);
    fireEvent.click(slotButtons()[0] as HTMLElement);
    expect(slotButtons()[0]).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(slotButtons()[2] as HTMLElement);
    expect(slotNames()).toEqual([
      'Slot 1: Charmander, level 1, 1 star',
      'Slot 2: Bulbasaur, level 1, 1 star',
      'Slot 3: Pikachu, level 1, 1 star',
    ]);
    expect(slotButtons()[0]).toHaveAttribute('aria-pressed', 'false');
  });

  it('removes from a slot, refuses a full team and replaces a selected slot', async () => {
    await load(
      makeSave({
        owned: [makeOwned(PIKACHU), makeOwned(BULBASAUR), makeOwned(SQUIRTLE)],
        team: [PIKACHU, BULBASAUR],
        trainer: { level: 3 },
      }),
    );
    render(<TeamDialog open onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /^Squirtle/ }));
    // Shown under the slots and announced.
    expect(screen.getAllByText(/Every open slot is taken/)).toHaveLength(2);
    expect(slotNames()).toHaveLength(2);

    fireEvent.click(slotButtons()[1] as HTMLElement);
    fireEvent.click(screen.getByRole('button', { name: /^Squirtle/ }));
    expect(slotNames()[1]).toBe('Slot 2: Squirtle, level 1, 1 star');

    fireEvent.click(screen.getByRole('button', { name: 'Remove Pikachu from slot 1' }));
    expect(slotNames()).toEqual(['Slot 1: Squirtle, level 1, 1 star']);
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
  });

  it('auto-fills the strongest and saves the team', async () => {
    const save = makeSave({
      owned: [
        makeOwned(PIKACHU, { level: 3 }),
        makeOwned(BULBASAUR, { level: 20 }),
        makeOwned(CHARMANDER, { level: 15 }),
      ],
      team: [PIKACHU],
      trainer: { level: 3 },
    });
    await load(save);
    const onSaved = vi.fn();
    const onClose = vi.fn();
    render(<TeamDialog open onClose={onClose} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole('button', { name: 'Auto-fill strongest' }));
    const expected = strongestTeam(save.collection, 2);
    expect(expected).toEqual([BULBASAUR, CHARMANDER]);
    expect(slotNames()).toEqual([
      'Slot 1: Bulbasaur, level 20, 1 star',
      'Slot 2: Charmander, level 15, 1 star',
    ]);
    fireEvent.click(screen.getByRole('button', { name: 'Save team' }));
    expect(getSave()?.team).toEqual(expected);
    expect(onSaved).toHaveBeenCalledWith(expected);
    expect(onClose).toHaveBeenCalled();
  });

  it('keeps the selection and says so when the team cannot be saved', async () => {
    await load(
      makeSave({
        owned: [makeOwned(PIKACHU), makeOwned(BULBASAUR)],
        team: [PIKACHU],
        trainer: { level: 3 },
      }),
    );
    const onClose = vi.fn();
    render(<TeamDialog open onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /^Bulbasaur/ }));
    flags.failUpdates = true;
    fireEvent.click(screen.getByRole('button', { name: 'Save team' }));
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't save the team. Try again");
    expect(onClose).not.toHaveBeenCalled();
    expect(slotNames()).toHaveLength(2);
    expect(getSave()?.team).toEqual([PIKACHU]);
  });

  it('pulses a newly unlocked slot and starts every opening from the saved team', async () => {
    await load(
      makeSave({
        owned: [makeOwned(PIKACHU), makeOwned(BULBASAUR)],
        team: [PIKACHU],
        trainer: { level: 3 },
      }),
    );
    const { rerender } = render(<TeamDialog open onClose={() => {}} highlightSlot={2} />);
    const slotsRegion = screen.getByRole('region', { name: 'Team slots' });
    expect(slotsRegion.querySelector('[data-highlight]')).toHaveAttribute(
      'data-slot-state',
      'empty',
    );

    fireEvent.click(screen.getByRole('button', { name: /^Bulbasaur/ }));
    expect(slotNames()).toHaveLength(2);
    rerender(<TeamDialog open={false} onClose={() => {}} />);
    rerender(<TeamDialog open onClose={() => {}} />);
    expect(slotNames()).toEqual(['Slot 1: Pikachu, level 1, 1 star']);
  });

  it('filters and sorts the roster', async () => {
    await load(
      makeSave({
        owned: [
          makeOwned(PIKACHU, { level: 2 }),
          makeOwned(BULBASAUR, { level: 9 }),
          makeOwned(CHARMANDER, { level: 5 }),
        ],
        team: [],
        trainer: { level: 1 },
      }),
    );
    render(<TeamDialog open onClose={() => {}} />);
    const roster = () =>
      within(screen.getByRole('region', { name: 'Your Pokémon' }))
        .getAllByRole('button')
        .map((b) => b.textContent?.split('Lv')[0]);
    expect(roster()).toEqual(['Bulbasaur', 'Charmander', 'Pikachu']);
    fireEvent.change(screen.getByLabelText('Sort by'), { target: { value: 'name' } });
    expect(roster()).toEqual(['Bulbasaur', 'Charmander', 'Pikachu']);
    fireEvent.change(screen.getByLabelText('Filter Pokémon'), { target: { value: 'pika' } });
    expect(roster()).toEqual(['Pikachu']);
    fireEvent.change(screen.getByLabelText('Filter Pokémon'), { target: { value: 'zzz' } });
    expect(screen.getByText('No Pokémon match “zzz”')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save team' })).toBeDisabled();
  });
});
