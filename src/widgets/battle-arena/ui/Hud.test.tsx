// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { BattleTeam, Fighter, Side } from '@/entities/battle';
import { initialHud, reduceHud } from '../model/hudState';
import { Hud } from './Hud';

const fighter = (side: Side, slot: number, over: Partial<Fighter> = {}): Fighter => ({
  id: `${side}-${slot}`,
  side,
  slot,
  name: `${side === 'red' ? 'Pikachu' : 'Rattata'} ${slot}`,
  pokemonId: 25,
  types: ['electric'],
  artwork: null,
  level: 5,
  badges: { stars: 0, talentIcons: [] },
  stats: { hp: 20, attack: 12, defense: 9, specialAttack: 11, specialDefense: 11, speed: 16 },
  moves: [],
  ...over,
});

const team = (side: Side, fighters: Fighter[]): BattleTeam => ({
  side,
  trainerName: side === 'red' ? 'Rowan' : 'Rival',
  fighters,
});

const red = team('red', [
  fighter('red', 0, {
    level: 7,
    badges: { stars: 3, talentIcons: ['offense', 'tempo', 'offense'] },
  }),
  fighter('red', 1),
  fighter('red', 2),
  fighter('red', 3),
]);
const blue = team(
  'blue',
  [0, 1, 2, 3].map((i) => fighter('blue', i, { level: 3 })),
);

const started = [
  { kind: 'enter', turn: 0, fighterId: 'red-0' },
  { kind: 'enter', turn: 0, fighterId: 'blue-0' },
] as const;
const hud = started.reduce(reduceHud, initialHud(red, blue));

function renderHud(over: Partial<Parameters<typeof Hud>[0]> = {}) {
  const props = {
    red,
    blue,
    hud,
    ready: true,
    speed: 1 as const,
    onSpeed: vi.fn(),
    onReplay: vi.fn(),
    onSkip: vi.fn(),
    canSkip: true,
    skipIn: 0,
    project: () => null,
    ...over,
  };
  render(<Hud {...props} />);
  return props;
}

describe('Hud', () => {
  it('shows the active fighter’s level, stars and talents with text alternatives', () => {
    renderHud();
    const corner = screen.getByRole('region', { name: 'Rowan, red corner' });
    expect(within(corner).getByText('Lv 7')).toBeInTheDocument();
    expect(within(corner).getByText('★3')).toBeInTheDocument();
    expect(corner).toHaveTextContent('3 stars');
    expect(corner).toHaveTextContent('2 offense talents');
    expect(corner).toHaveTextContent('1 tempo talent');
    expect(corner).not.toHaveTextContent('defense');
  });

  it('lists all four fighters per side with their level (4×4)', () => {
    renderHud();
    for (const name of ['Rowan, red corner', 'Rival, blue corner']) {
      const items = within(screen.getByRole('region', { name })).getAllByRole('listitem');
      expect(items).toHaveLength(4);
    }
    expect(screen.getByRole('region', { name: 'Rival, blue corner' })).toHaveTextContent(
      'Rattata 0, Lv 3, in battle',
    );
  });

  it('hides the star badge for a fighter without stars', () => {
    renderHud();
    const corner = screen.getByRole('region', { name: 'Rival, blue corner' });
    expect(corner).not.toHaveTextContent('★');
    expect(corner).not.toHaveTextContent('star');
  });

  it('locks Skip with a visible countdown, still focusable', async () => {
    const user = userEvent.setup();
    const props = renderHud({ skipIn: 3 });
    const skip = screen.getByRole('button', { name: 'Skip in 3 s' });
    expect(skip).toHaveAttribute('aria-disabled', 'true');
    expect(skip).not.toBeDisabled();
    await user.click(skip);
    expect(props.onSkip).not.toHaveBeenCalled();
  });

  it('Skip to result is a real button once unlocked', async () => {
    const user = userEvent.setup();
    const props = renderHud();
    const skip = screen.getByRole('button', { name: 'Skip to result' });
    expect(skip).not.toHaveAttribute('aria-disabled');
    await user.click(skip);
    expect(props.onSkip).toHaveBeenCalledTimes(1);
  });

  it('disables Skip when there is nothing to skip', () => {
    renderHud({ canSkip: false });
    expect(screen.getByRole('button', { name: 'Skip to result' })).toBeDisabled();
  });

  it('toggles ×2 with aria-pressed and only offers New battle when asked', async () => {
    const user = userEvent.setup();
    const props = renderHud({ speed: 2 });
    const double = screen.getByRole('button', { name: 'Double speed' });
    expect(double).toHaveAttribute('aria-pressed', 'true');
    await user.click(double);
    expect(props.onSpeed).toHaveBeenCalledWith(1);
    expect(screen.queryByRole('button', { name: 'New battle' })).toBeNull();
  });
});
