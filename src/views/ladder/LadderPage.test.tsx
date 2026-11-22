// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { stageInfo } from '@/entities/ladder';
import { polyfillDom } from '@/entities/ladder/testing/testDom';
import { makeOwned, makeSave } from '@/entities/ladder/testing/testSave';
import { initSave, type Save } from '@/entities/save';
import { __resetSaveStoreForTests } from '@/entities/save/model/store';
import { economy } from '@/shared/config/economy';
import { LadderPage } from './LadderPage';

const nav = vi.hoisted(() => ({ search: '', replace: vi.fn() }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: nav.replace }),
  useSearchParams: () => new URLSearchParams(nav.search),
}));

beforeAll(polyfillDom);

const STAGES = economy.battle.ladderStages;
const PIKACHU = 25;
const BULBASAUR = 1;

async function open(save: Save, search = '') {
  nav.search = search;
  render(<LadderPage />);
  await act(() =>
    initSave(
      { durable: true, load: async () => ({ kind: 'loaded', save }), write: async () => true },
      () => save,
    ),
  );
}

const nodes = () => within(screen.getByRole('list', { name: 'Stages' })).getAllByRole('button');
const node = (stage: number) => {
  const found = nodes()[stage - 1];
  if (!found) throw new Error(`no node ${stage}`);
  return found;
};
const panel = () => screen.getByRole('region', { name: /^Stage \d+ · Rival/ });

describe('LadderPage', () => {
  beforeEach(() => {
    vi.stubEnv('__NEXT_TRAILING_SLASH', 'true');
    __resetSaveStoreForTests();
    nav.replace.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it('renders its own main and one h1 with a skeleton while loading', () => {
    render(<LadderPage />);
    expect(screen.getByRole('main')).toHaveAttribute('id', 'content');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Ladder');
    expect(screen.getByTestId('ladder-skeleton')).toBeInTheDocument();
  });

  it('opens with the current stage centred in the scrolling path', async () => {
    // jsdom has no layout: give the path 60px rows in a 384px scroll area at y = 200, and record
    // what the path sets its scrollTop to. Each node sits in a `relative` <li>, so only measured
    // positions (not offsetTop) find it.
    const ROW = 60;
    let scrolled = 0;
    const rect = (top: number, height: number) =>
      ({
        top,
        height,
        bottom: top + height,
        left: 0,
        right: 300,
        width: 300,
        x: 0,
        y: top,
      }) as DOMRect;
    const restore = [
      vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
        this: Element,
      ) {
        if (this.tagName === 'OL') return rect(200, 384);
        const li = this.closest('li');
        const index = li ? [...(li.parentElement?.children ?? [])].indexOf(li) : 0;
        return rect(200 + index * ROW - scrolled, 56);
      }),
      vi.spyOn(Element.prototype, 'clientHeight', 'get').mockImplementation(function (
        this: Element,
      ) {
        return this.tagName === 'OL' ? 384 : 0;
      }),
      vi.spyOn(Element.prototype, 'scrollHeight', 'get').mockImplementation(function (
        this: Element,
      ) {
        return this.tagName === 'OL' ? STAGES * ROW : 0;
      }),
      vi.spyOn(Element.prototype, 'scrollTop', 'set').mockImplementation(function (value: number) {
        scrolled = value;
      }),
    ];
    try {
      await open(makeSave({ owned: [makeOwned(PIKACHU)], ladder: { cleared: 11 } }));
      // Stage 12 (index 11): 660px down the list, centred = 660 - (384 - 56) / 2.
      expect(scrolled).toBe(11 * ROW - (384 - 56) / 2);
    } finally {
      restore.forEach((spy) => spy.mockRestore());
    }
  });

  it('shows cleared, current and locked nodes', async () => {
    await open(makeSave({ owned: [makeOwned(PIKACHU)], ladder: { cleared: 6 } }));
    expect(screen.getByText(`Stage 6 / ${STAGES} cleared`)).toBeInTheDocument();
    expect(nodes()).toHaveLength(STAGES);
    expect(node(6)).toHaveAttribute('data-status', 'cleared');
    expect(node(6)).toHaveTextContent('Cleared');
    expect(node(7)).toHaveAttribute('aria-current', 'step');
    expect(node(8)).toHaveAttribute('aria-disabled', 'true');
    expect(node(8)).toHaveTextContent('Clear stage 7 first');
    expect(node(8)).not.toHaveAttribute('aria-current');
    // The current stage starts selected and is the path's one tab stop.
    expect(node(7)).toHaveAttribute('tabindex', '0');
    expect(node(6)).toHaveAttribute('tabindex', '-1');
  });

  it('shows the selected rival, power and first-clear reward, with Fight to the battle', async () => {
    await open(makeSave({ owned: [makeOwned(PIKACHU, { level: 5 })], ladder: { cleared: 2 } }));
    const info = stageInfo(3);
    expect(panel()).toHaveAccessibleName(`Stage 3 · Rival ${info.rivalName}`);
    expect(within(panel()).getByText('Recommended power')).toBeInTheDocument();
    expect(within(panel()).getByText('First clear')).toBeInTheDocument();
    expect(within(panel()).getByText(/\+1 Capsule/)).toBeInTheDocument();
    expect(within(panel()).getByRole('list', { name: 'Rival team' }).children).toHaveLength(
      info.rival.length,
    );
    expect(within(panel()).getByRole('link', { name: 'Fight' })).toHaveAttribute(
      'href',
      '/battle/?stage=3',
    );
  });

  it('moves between nodes with the arrow keys; selecting a cleared node offers a replay', async () => {
    await open(makeSave({ owned: [makeOwned(PIKACHU)], ladder: { cleared: 3, replayWins: 2 } }));
    node(4).focus();
    fireEvent.keyDown(node(4), { key: 'ArrowUp' });
    expect(node(3)).toHaveFocus();
    expect(node(3)).toHaveAttribute('aria-pressed', 'true');
    expect(panel()).toHaveAccessibleName(`Stage 3 · Rival ${stageInfo(3).rivalName}`);
    expect(within(panel()).getByText('Cleared · replay for XP')).toBeInTheDocument();
    expect(
      within(panel()).getByText(
        new RegExp(`Replay streak 2 / ${economy.battle.replayCapsuleEveryWins}`),
      ),
    ).toBeInTheDocument();

    // Focus can rest on a locked node, but the selection stays.
    fireEvent.keyDown(node(3), { key: 'ArrowDown' });
    fireEvent.keyDown(node(4), { key: 'ArrowDown' });
    expect(node(5)).toHaveFocus();
    expect(node(5)).toHaveAttribute('aria-disabled', 'true');
    expect(panel()).toHaveAccessibleName(`Stage 4 · Rival ${stageInfo(4).rivalName}`);
    fireEvent.click(node(5));
    expect(
      screen.getByText('Clear stage 4 first', { selector: '[role=status]' }),
    ).toBeInTheDocument();

    fireEvent.keyDown(node(5), { key: 'Home' });
    expect(node(1)).toHaveFocus();
    fireEvent.click(node(2));
    expect(panel()).toHaveAccessibleName(`Stage 2 · Rival ${stageInfo(2).rivalName}`);
  });

  it('turns Fight into Fill team while open slots are empty and more Pokémon are owned', async () => {
    await open(
      makeSave({
        owned: [makeOwned(PIKACHU), makeOwned(BULBASAUR)],
        team: [PIKACHU],
        trainer: { level: 5 },
      }),
    );
    expect(within(panel()).queryByRole('link', { name: 'Fight' })).not.toBeInTheDocument();
    fireEvent.click(within(panel()).getByRole('button', { name: 'Fill team' }));
    expect(screen.getByRole('dialog', { name: 'Team' })).toBeInTheDocument();
  });

  it('keeps Fight when every owned Pokémon is already in the team', async () => {
    await open(makeSave({ owned: [makeOwned(PIKACHU)], trainer: { level: 5 } }));
    expect(within(panel()).getByRole('link', { name: 'Fight' })).toBeInTheDocument();
  });

  it('says when the ladder is complete', async () => {
    await open(makeSave({ owned: [makeOwned(PIKACHU)], ladder: { cleared: STAGES } }));
    expect(
      screen.getByText('Ladder complete. Replay any stage for XP and capsules.'),
    ).toBeInTheDocument();
    expect(nodes().every((n) => n.dataset.status === 'cleared')).toBe(true);
    expect(within(panel()).getByRole('link', { name: 'Fight' })).toHaveAttribute(
      'href',
      `/battle/?stage=${STAGES}`,
    );
  });

  it('says "Stage locked" after a redirect from the battle page', async () => {
    await open(makeSave({ owned: [makeOwned(PIKACHU)] }), 'locked=5');
    expect(screen.getByText('Stage locked')).toBeInTheDocument();
    expect(screen.getByText('Stage locked').closest('[role=status]')).not.toBeNull();
  });

  it('sends players home before onboarding is done', async () => {
    await open(
      makeSave({ onboarding: { step: 'dealt', loanerSpeciesId: 25, rivalSpeciesId: 19 } }),
    );
    expect(nav.replace).toHaveBeenCalledWith('/');
    expect(screen.queryByRole('list', { name: 'Stages' })).not.toBeInTheDocument();
  });
});
