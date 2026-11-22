// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BattleResult, BattleTeam, Fighter, Move, Side } from '@/entities/battle';
import { BattleArena } from './BattleArena';

// jsdom has no matchMedia; GSAP and the motion setting read it at import time.
vi.hoisted(() => {
  window.matchMedia ??= (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
});

const TACKLE: Move = {
  name: 'tackle',
  type: 'normal',
  power: 40,
  accuracy: 100,
  damageClass: 'physical',
};

const fighter = (side: Side, slot: number, name: string): Fighter => ({
  id: `${side}-${slot}`,
  side,
  slot,
  name,
  pokemonId: 25,
  types: ['normal'],
  artwork: null,
  level: side === 'red' ? 5 : 3,
  badges: { stars: 1, talentIcons: [] },
  stats: { hp: 20, attack: 12, defense: 9, specialAttack: 11, specialDefense: 11, speed: 16 },
  moves: [TACKLE],
});

const team = (side: Side, names: string[]): BattleTeam => ({
  side,
  trainerName: side === 'red' ? 'Rowan' : 'Rival',
  fighters: names.map((n, i) => fighter(side, i, n)),
});

const RED = team('red', ['Pikachu']);
const BLUE = team('blue', ['Rattata']);

beforeEach(() => {
  // jsdom has no WebGL: the arena falls back to the text battle (as on a device without WebGL2).
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

const arena = () => screen.getByLabelText('Arena');
const waitUntilPlaying = () => screen.findByText(/3D isn’t available on this device/);

describe('BattleArena', () => {
  it('prepares, then tells the battle in text when WebGL is missing', async () => {
    render(<BattleArena red={RED} blue={BLUE} seed={1} />);
    expect(arena()).toHaveAttribute('data-phase', 'loading');
    expect(screen.getAllByText('Preparing arena').length).toBeGreaterThan(0);
    await waitUntilPlaying();
    expect(arena()).toHaveAttribute('data-phase', 'playing');
    expect(screen.getByRole('button', { name: /^Battle log/ })).toBeInTheDocument();
  });

  it('Skip jumps to the result, announces it in one phrase, focuses the main button and fires onFinished once', async () => {
    const user = userEvent.setup();
    const onFinished = vi.fn<(r: BattleResult) => void>();
    render(<BattleArena red={RED} blue={BLUE} seed={7} onFinished={onFinished} />);
    await waitUntilPlaying();

    const liveLog = document.querySelector('[aria-live="polite"]');
    const announcedBefore = liveLog?.textContent ?? '';
    await user.click(screen.getByRole('button', { name: 'Skip to result' }));
    expect(arena()).toHaveAttribute('data-phase', 'result');
    // The jumped-over play-by-play is listed in the log but not read out.
    expect(screen.getByRole('button', { name: /^Battle log/ })).toHaveTextContent(/wins by/);
    expect(liveLog?.textContent ?? '').toBe(announcedBefore);
    expect(screen.getByRole('heading', { name: /wins!/ })).toBeInTheDocument();
    expect(onFinished).toHaveBeenCalledTimes(1);
    const result = onFinished.mock.calls[0]?.[0];
    expect(result).toMatchObject({ reason: 'knockout' });
    expect(result?.redDamageDealt).toBe(
      result?.fighters.find((f) => f.fighterId === 'red-0')?.damageDealt,
    );
    const winner = result?.winner === 'red' ? 'Rowan' : 'Rival';
    expect(
      screen.getAllByRole('status').some((s) => s.textContent === `${winner} wins by knockout.`),
    ).toBe(true);
    const overlay = screen.getByRole('region', { name: /wins!/ });
    expect(within(overlay).getByRole('button', { name: 'Replay' })).toHaveFocus();

    // Replay plays the same battle again; skipping it again does not report it twice.
    await user.click(within(overlay).getByRole('button', { name: 'Replay' }));
    expect(arena()).toHaveAttribute('data-phase', 'playing');
    await user.click(screen.getByRole('button', { name: 'Skip to result' }));
    expect(screen.getByRole('heading', { name: /wins!/ })).toBeInTheDocument();
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it('renders the caller’s result screen and message instead of the default one', async () => {
    const user = userEvent.setup();
    render(
      <BattleArena
        red={RED}
        blue={BLUE}
        seed={3}
        resultMessage={(r) => (r.winner === 'red' ? 'Victory. 1 capsule earned.' : 'Defeated.')}
        renderResult={(r, { replay }) => (
          <div>
            <p>Custom result: {r.winner}</p>
            <button type="button" onClick={replay}>
              Again
            </button>
          </div>
        )}
      />,
    );
    await waitUntilPlaying();
    await user.click(screen.getByRole('button', { name: 'Skip to result' }));
    expect(screen.getByText(/Custom result:/)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /wins!/ })).toBeNull();
    expect(
      screen
        .getAllByRole('status')
        .some(
          (s) => s.textContent === 'Victory. 1 capsule earned.' || s.textContent === 'Defeated.',
        ),
    ).toBe(true);

    await user.click(screen.getByRole('button', { name: 'Again' }));
    expect(screen.queryByText(/Custom result:/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Replay' })).toHaveFocus();
  });

  it('in intro mode, Skip unlocks after 5 s; before that it explains why and does nothing', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const user = userEvent.setup();
    const onFinished = vi.fn();
    render(<BattleArena red={RED} blue={BLUE} seed={1} intro onFinished={onFinished} />);
    await waitUntilPlaying();

    const locked = screen.getByRole('button', { name: 'Skip in 5 s' });
    expect(locked).toHaveAttribute('aria-disabled', 'true');
    await user.click(locked);
    expect(onFinished).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(3000));
    expect(screen.getByRole('button', { name: 'Skip in 2 s' })).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(2000));
    await user.click(screen.getByRole('button', { name: 'Skip to result' }));
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it('lays out 1–4 fighters per side in the text battle', async () => {
    const user = userEvent.setup();
    const names = ['Bulbasaur', 'Charmander', 'Squirtle', 'Pidgey'];
    render(
      <BattleArena
        red={team('red', names)}
        blue={team('blue', ['Rattata', 'Spearow', 'Ekans', 'Zubat'])}
        seed={2}
        onNewBattle={() => {}}
      />,
    );
    await waitUntilPlaying();
    for (const name of [...names, 'Zubat']) expect(arena()).toHaveTextContent(name);
    expect(screen.getByRole('button', { name: 'New battle' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Skip to result' }));
    // Every knocked-out fighter on the losing side reads as KO in the lineup.
    expect(arena().textContent?.match(/KO/g)?.length ?? 0).toBeGreaterThanOrEqual(4);
  });
});
