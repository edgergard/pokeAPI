// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { polyfillDom } from '@/entities/ladder/testing/testDom';
import { LevelUpDialog } from './LevelUpDialog';

beforeAll(polyfillDom);

describe('LevelUpDialog', () => {
  beforeEach(() => vi.stubEnv('__NEXT_TRAILING_SLASH', 'true'));
  afterEach(() => vi.unstubAllEnvs());

  it('titles the new level, lists the unlocks and focuses "Fill slot N"', () => {
    const onFillSlot = vi.fn();
    const onClose = vi.fn();
    render(
      <LevelUpDialog
        open
        onClose={onClose}
        onFillSlot={onFillSlot}
        result={{
          toLevel: 3,
          unlocks: [
            { kind: 'teamSlot', slots: 2 },
            { kind: 'dailyQuests' },
            { kind: 'talentPoint', count: 1 },
          ],
        }}
      />,
    );
    const dialog = screen.getByRole('dialog', { name: 'Trainer Lv 3' });
    expect(dialog).toBeInTheDocument();
    const items = screen.getByRole('list', { name: 'Unlocked' }).querySelectorAll('li');
    expect([...items].map((li) => li.textContent)).toEqual([
      'Team slot 2',
      'Daily quests',
      '1 talent point',
    ]);
    const primary = screen.getByRole('button', { name: 'Fill slot 2' });
    expect(primary).toHaveFocus();
    fireEvent.click(primary);
    expect(onFillSlot).toHaveBeenCalledWith(2);
    fireEvent.click(screen.getByRole('button', { name: 'Later' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('sends daily quests to Home and talent points to the trainer screen', () => {
    const { rerender } = render(
      <LevelUpDialog
        open
        onClose={() => {}}
        onFillSlot={() => {}}
        result={{
          toLevel: 2,
          unlocks: [{ kind: 'dailyQuests' }, { kind: 'talentPoint', count: 1 }],
        }}
      />,
    );
    expect(screen.getByRole('link', { name: 'See quests' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'See quests' })).toHaveFocus();
    rerender(
      <LevelUpDialog
        open
        onClose={() => {}}
        onFillSlot={() => {}}
        result={{ toLevel: 4, unlocks: [{ kind: 'talentPoint', count: 1 }] }}
      />,
    );
    expect(screen.getByRole('link', { name: 'Learn talent' })).toHaveAttribute('href', '/trainer/');
  });

  it('shows "+1 talent point" for a level without unlocks and a burst unless motion is reduced', () => {
    render(
      <LevelUpDialog
        open
        onClose={() => {}}
        onFillSlot={() => {}}
        result={{ toLevel: 31, unlocks: [] }}
      />,
    );
    expect(screen.getByText('+1 talent point')).toBeInTheDocument();
    expect(screen.getByTestId('level-up-burst')).toBeInTheDocument();
  });
});
