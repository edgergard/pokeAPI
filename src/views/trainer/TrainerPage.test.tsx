// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { nextUnlock, xpToNextTrainerLevel } from '@/entities/progression';
import { createNewSave, getSave, initSave, type Save } from '@/entities/save';
import { __resetSaveStoreForTests } from '@/entities/save/model/store';
import { economy } from '@/shared/config/economy';
import { TrainerPage } from './TrainerPage';
import { polyfillDom } from './testDom';

beforeAll(polyfillDom);

function testSave(trainer: Partial<Save['trainer']> = {}): Save {
  const save = createNewSave({ seed: 1, now: 0, name: 'Misty' });
  return { ...save, trainer: { ...save.trainer, ...trainer } };
}

async function show(save: Save) {
  render(<TrainerPage />);
  await act(() =>
    initSave(
      { durable: true, load: async () => ({ kind: 'loaded', save }), write: async () => true },
      () => save,
    ),
  );
}

const status = () => screen.getByTestId('trainer-status');

describe('TrainerPage', () => {
  beforeEach(() => {
    vi.stubEnv('__NEXT_TRAILING_SLASH', 'true');
    __resetSaveStoreForTests();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('renders one h1 "Trainer" and a skeleton while loading', () => {
    render(<TrainerPage />);
    expect(screen.getByRole('main')).toHaveAttribute('id', 'content');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Trainer');
    expect(screen.getByRole('status', { name: 'Loading trainer' })).toBeInTheDocument();
  });

  describe('rename', () => {
    it('Enter saves the trimmed name and gives focus back to the name button', async () => {
      const user = userEvent.setup();
      await show(testSave());
      await user.click(screen.getByRole('button', { name: 'Rename Misty' }));
      const field = screen.getByRole('textbox', { name: 'Trainer name' });
      expect(field).toHaveFocus();
      expect(field).toHaveValue('Misty');
      await user.clear(field);
      await user.type(field, '  Brock  {Enter}');
      expect(getSave()?.trainer.name).toBe('Brock');
      expect(screen.getByRole('button', { name: 'Rename Brock' })).toHaveFocus();
      expect(status()).toHaveTextContent('Name saved: Brock');
    });

    it.each([['   '], ['x'.repeat(25)]])('rejects %j inline and saves nothing', async (input) => {
      const user = userEvent.setup();
      await show(testSave());
      await user.click(screen.getByRole('button', { name: 'Rename Misty' }));
      const field = screen.getByRole('textbox', { name: 'Trainer name' });
      await user.clear(field);
      await user.type(field, `${input}{Enter}`);
      expect(field).toHaveAttribute('aria-invalid', 'true');
      expect(field).toHaveAccessibleDescription('Use 1 to 24 characters.');
      expect(getSave()?.trainer.name).toBe('Misty');
    });

    it('Esc cancels and restores focus to the name button', async () => {
      const user = userEvent.setup();
      await show(testSave());
      await user.click(screen.getByRole('button', { name: 'Rename Misty' }));
      await user.type(screen.getByRole('textbox', { name: 'Trainer name' }), 'zzz{Escape}');
      expect(screen.queryByRole('textbox', { name: 'Trainer name' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Rename Misty' })).toHaveFocus();
      expect(getSave()?.trainer.name).toBe('Misty');
    });
  });

  it('shows level and XP towards the next level', async () => {
    await show(testSave({ level: 3, xp: 120 }));
    const profile = screen.getByRole('region', { name: 'Trainer profile' });
    expect(profile).toHaveTextContent(`Lv 3 / ${economy.trainer.maxLevel}`);
    const bar = screen.getByRole('progressbar', { name: 'Trainer XP to level 4' });
    expect(bar).toHaveAttribute('aria-valuenow', '120');
    expect(bar).toHaveAttribute('aria-valuemax', String(xpToNextTrainerLevel(3)));
  });

  it('lists every level of the unlock timeline, marks reached ones and the next unlock', async () => {
    await show(testSave({ level: 3 }));
    const levels = screen.getByRole('group', { name: 'Trainer levels, scrollable' });
    const items = levels.querySelectorAll('li[data-level]');
    expect(items).toHaveLength(economy.trainer.maxLevel);
    expect(levels.querySelectorAll('li[data-reached]')).toHaveLength(3);
    const next = nextUnlock(3);
    const current = levels.querySelector('[aria-current="step"]');
    expect(current).toHaveAttribute('data-level', String(next?.level));
    expect(current).toHaveTextContent(`Team slot 3`);
    const level2 = levels.querySelector('li[data-level="2"]');
    expect(level2).toHaveTextContent('Daily quests');
    expect(level2).toHaveTextContent('Talent: Field Notes');
  });

  it('shows locked / available / learned trainer talents with reasons', async () => {
    await show(testSave({ level: 5, talentPoints: 2, talents: [] }));
    expect(screen.getByRole('group', { name: 'Training' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Capstones' })).toBeInTheDocument();

    const fieldNotes = screen.getByRole('button', { name: 'Field Notes' });
    expect(fieldNotes).toHaveAttribute('aria-pressed', 'false');
    expect(fieldNotes).not.toHaveAttribute('aria-disabled');

    const sparring = screen.getByRole('button', { name: 'Sparring Partners' });
    expect(sparring).toHaveAttribute('aria-disabled', 'true');
    expect(sparring).toHaveAccessibleDescription(/Requires: Field Notes/);

    const veteran = screen.getByRole('button', { name: 'Veteran Coach' });
    expect(veteran).toHaveAccessibleDescription(/Requires Trainer Lv 9/);

    // A capstone repeats all its prerequisites as text.
    expect(screen.getByRole('button', { name: 'Lucky Streak' })).toHaveAccessibleDescription(
      /Requires: Treasure Sense, Eagle Eye/,
    );
  });

  it('"Learn talent" spends a point', async () => {
    const user = userEvent.setup();
    await show(testSave({ level: 5, talentPoints: 1, talents: [] }));
    const node = screen.getByRole('button', { name: 'Field Notes' });
    expect(node).toHaveTextContent('Learn talent');
    await user.click(node);
    expect(getSave()?.trainer.talentPoints).toBe(0);
    expect(getSave()?.trainer.talents).toEqual(['field-notes']);
    expect(node).toHaveAttribute('aria-pressed', 'true');
    expect(status()).toHaveTextContent('Learned Field Notes');
    // No points left: the next level that grants one is named.
    expect(screen.getByRole('button', { name: 'Dust Collector' })).toHaveAccessibleDescription(
      /Next point at Lv 6/,
    );
    expect(
      within(screen.getByRole('region', { name: 'Trainer talents' })).getAllByText(
        'Next point at Lv 6',
      ).length,
    ).toBeGreaterThan(1);
  });

  it('"Reset tree" asks for confirmation, then refunds every point', async () => {
    const user = userEvent.setup();
    await show(testSave({ level: 5, talentPoints: 0, talents: ['field-notes', 'dust-collector'] }));

    const tree = screen.getByRole('region', { name: 'Trainer talents' });
    await user.click(within(tree).getByRole('button', { name: 'Reset tree' }));
    const dialog = screen.getByRole('dialog', { name: 'Reset the trainer tree?' });
    expect(within(dialog).getByText('2 talent points come back:')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(getSave()?.trainer.talents).toHaveLength(2);

    await user.click(within(tree).getByRole('button', { name: 'Reset tree' }));
    await user.click(
      within(screen.getByRole('dialog', { name: 'Reset the trainer tree?' })).getByRole('button', {
        name: 'Reset tree',
      }),
    );
    expect(getSave()?.trainer.talents).toEqual([]);
    expect(getSave()?.trainer.talentPoints).toBe(2);
    expect(status()).toHaveTextContent('Trainer talents reset. 2 points refunded.');
  });

  it('keeps "Reset tree" inert with nothing learned', async () => {
    const user = userEvent.setup();
    await show(testSave({ level: 5, talentPoints: 1 }));
    const reset = screen.getByRole('button', { name: 'Reset tree' });
    expect(reset).toHaveAttribute('aria-disabled', 'true');
    await user.click(reset);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
