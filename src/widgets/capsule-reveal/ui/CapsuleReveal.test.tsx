// @vitest-environment jsdom
// Typed jest-dom matchers (vitest.setup.ts registers them at runtime but is outside tsconfig).
import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { setMotionPreference } from '@/shared/lib/motion';
import { REVEAL_MS } from '../model/reveal';
import { capsuleResult, craftResult } from '../model/testResults';
import { CapsuleReveal } from './CapsuleReveal';
import { polyfillDom } from './testDom';

beforeAll(polyfillDom);

const phaseOf = (container: HTMLElement) =>
  container.ownerDocument.querySelector('[data-reveal-phase]')?.getAttribute('data-reveal-phase');
const indexOf = (container: HTMLElement) =>
  Number(
    container.ownerDocument.querySelector('[data-reveal-index]')?.getAttribute('data-reveal-index'),
  );
const status = () => screen.getByRole('status');
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
/** Fires the pending stage timer: exactly one stage forward (the next timer is set after the re-render). */
const step = (times = 1) => {
  for (let i = 0; i < times; i++) act(() => vi.runOnlyPendingTimers());
};

function setup(props: Partial<Parameters<typeof CapsuleReveal>[0]> = {}) {
  const onClose = vi.fn();
  const onPrimary = vi.fn();
  const utils = render(
    <CapsuleReveal
      results={[capsuleResult(25)]}
      open
      onClose={onClose}
      primaryLabel="Done"
      onPrimary={onPrimary}
      {...props}
    />,
  );
  return { ...utils, onClose, onPrimary };
}

describe('CapsuleReveal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setMotionPreference('on');
  });
  afterEach(() => {
    vi.useRealTimers();
    setMotionPreference('system');
  });

  it('opens a native dialog titled "Capsule" and plays shake → flash → card', () => {
    const { container } = setup();
    expect(screen.getByRole('dialog', { name: 'Capsule' })).toBeInTheDocument();
    expect(phaseOf(container)).toBe('charge');
    // The face-down card is hidden from assistive tech until it flips.
    expect(screen.queryByRole('article')).not.toBeInTheDocument();
    expect(status()).toHaveTextContent('');

    advance(REVEAL_MS.charge);
    expect(phaseOf(container)).toBe('flash');
    advance(REVEAL_MS.flash);
    expect(phaseOf(container)).toBe('card');
    expect(status()).toHaveTextContent(/: Pikachu, new$/);
    expect(screen.getByText('New! Pikachu joined your collection.')).toBeInTheDocument();

    advance(REVEAL_MS.hold);
    expect(phaseOf(container)).toBe('done');
    expect(screen.getByRole('button', { name: 'Done' })).toHaveFocus();
    expect(screen.queryByRole('button', { name: /skip/i })).not.toBeInTheDocument();
  });

  it('Skip jumps to the result without closing, and the result is still announced', () => {
    const { container, onClose } = setup();
    const skip = screen.getByRole('button', { name: /skip/i });
    expect(skip).toHaveFocus();
    fireEvent.click(skip);
    expect(phaseOf(container)).toBe('done');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByText('New! Pikachu joined your collection.')).toBeInTheDocument();
    expect(status()).toHaveTextContent(/: Pikachu, new$/);
    expect(screen.getByRole('article')).toHaveAccessibleName(/Pikachu, New, level 1, 1 stars/);
  });

  it('Esc skips the animation first and closes only once the reveal is done', () => {
    const { container, onClose } = setup();
    const dialog = screen.getByRole('dialog');
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(phaseOf(container)).toBe('done');
    expect(onClose).not.toHaveBeenCalled();
    fireEvent(dialog, new Event('cancel', { cancelable: true }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('uses the primary label and action from props, and offers "Open next"', () => {
    const onOpenNext = vi.fn();
    const { onPrimary } = setup({ primaryLabel: 'Add to team', onOpenNext });
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Add to team' }));
    expect(onPrimary).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Open next' }));
    expect(onOpenNext).toHaveBeenCalledTimes(1);
  });

  it('reveals the rarest card last, then shows a summary with New / ★ up / +dust', () => {
    const results = [
      capsuleResult(1, { rarity: 'epic', outcome: 'starUp', stars: 3, pullIndex: 0 }),
      capsuleResult(2, { rarity: 'common', pullIndex: 1 }),
      capsuleResult(3, {
        rarity: 'common',
        outcome: 'dust',
        stars: 5,
        dustGained: 5,
        pullIndex: 2,
      }),
    ];
    const { container } = setup({ results });

    step(2); // charge → flash → card
    expect(status()).toHaveTextContent('Common: Ivysaur, new');
    step(3); // hold → next charge → flash → card
    expect(indexOf(container)).toBe(1);
    expect(status()).toHaveTextContent(/Common: Venusaur, duplicate at max stars, plus 5 dust/);
    step(3);
    expect(indexOf(container)).toBe(2);
    expect(status()).toHaveTextContent('Epic: Bulbasaur, star up, now 3 stars');

    step();
    expect(phaseOf(container)).toBe('done');
    const grid = screen.getByRole('list', { name: 'Capsule results' });
    const items = within(grid).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringMatching(/Ivysaur.*Common.*New/),
      expect.stringMatching(/Venusaur.*Common.*\+5 dust/),
      expect.stringMatching(/Bulbasaur.*Epic.*★ up/),
    ]);
    expect(status()).toHaveTextContent('3 capsules opened: 1 new, 1 star up, +5 dust.');
  });

  it('shows the pity footer: ticking, or reset with the numbers from the results', () => {
    setup({
      results: [
        capsuleResult(25, {
          pity: { tier: 'great', rarity: 'epic', opens: 20, count: 0, left: 20, reset: true },
        }),
      ],
    });
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    const meter = screen.getByRole('progressbar');
    expect(meter).toHaveAttribute('aria-valuenow', '0');
    expect(meter).toHaveAttribute('aria-valuemax', '20');
    expect(screen.getByText('Pity reset · Epic within 20')).toBeInTheDocument();
  });

  it('notes the first-capsule guarantee', () => {
    setup({ results: [capsuleResult(25, { firstCapsule: true })] });
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    expect(screen.getByText(/^First capsule · .* or better guaranteed$/)).toBeInTheDocument();
  });

  it('crossfades without shake or flash under reduced motion', () => {
    setMotionPreference('off');
    const { container } = setup();
    expect(phaseOf(container)).toBe('charge');
    advance(REVEAL_MS.reducedCharge);
    expect(phaseOf(container)).toBe('card');
    expect(status()).toHaveTextContent(/Pikachu, new/);
  });

  it('restarts the ritual when new results arrive ("Open next")', () => {
    const { container, rerender, onClose, onPrimary } = setup();
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    expect(phaseOf(container)).toBe('done');
    rerender(
      <CapsuleReveal
        results={[capsuleResult(133)]}
        open
        onClose={onClose}
        primaryLabel="Done"
        onPrimary={onPrimary}
      />,
    );
    expect(phaseOf(container)).toBe('charge');
    step(3);
    expect(phaseOf(container)).toBe('done');
    expect(screen.getByText('New! Eevee joined your collection.')).toBeInTheDocument();
  });

  it('reveals a crafted Pokémon as a single new card', () => {
    setup({ results: [craftResult(133)], title: 'Crafted with dust' });
    expect(screen.getByRole('dialog', { name: 'Crafted with dust' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /skip/i }));
    expect(screen.getByText('New! Eevee joined your collection.')).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});
