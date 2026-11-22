// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { stageInfo } from '@/entities/ladder';
import { polyfillDom } from '@/entities/ladder/testing/testDom';
import { makeOwned, makeSave } from '@/entities/ladder/testing/testSave';
import { xpToNextTrainerLevel } from '@/entities/progression';
import { getSave, initSave, type Save } from '@/entities/save';
import { __resetSaveStoreForTests } from '@/entities/save/model/store';
import { economy } from '@/shared/config/economy';
import { hashSeed } from '@/shared/lib/rng';
import BattlePage from './BattlePage';

// jsdom has no matchMedia; GSAP (pulled in by the arena widget) reads it at import time.
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

const nav = vi.hoisted(() => ({
  search: '',
  push: vi.fn(),
  replace: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
  useSearchParams: () => new URLSearchParams(nav.search),
}));
vi.mock('@/widgets/battle-arena', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/widgets/battle-arena')>();
  const { FakeArena } = await import('./testing/FakeArena');
  return { ...actual, BattleArena: FakeArena };
});

beforeAll(polyfillDom);

const PIKACHU = 25;
const BULBASAUR = 1;
const RATTATA = 19;

async function load(save: Save) {
  await act(() =>
    initSave(
      { durable: true, load: async () => ({ kind: 'loaded', save }), write: async () => true },
      () => save,
    ),
  );
}

async function open(search: string, save: Save) {
  nav.search = search;
  render(<BattlePage />);
  await load(save);
}

const fight = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Fight' }));
  return screen.findByTestId('arena');
};

describe('BattlePage routing', () => {
  beforeEach(() => {
    vi.stubEnv('__NEXT_TRAILING_SLASH', 'true');
    __resetSaveStoreForTests();
    nav.push.mockReset();
    nav.replace.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it('renders its own main with one h1 while the save loads', () => {
    nav.search = 'stage=1';
    render(<BattlePage />);
    expect(screen.getByRole('main')).toHaveAttribute('id', 'content');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('status', { name: 'Loading the battle' })).toBeInTheDocument();
  });

  it('sends deep links home before onboarding is done', async () => {
    await open('stage=1', makeSave({ onboarding: { step: 'hero' } }));
    expect(nav.replace).toHaveBeenCalledWith('/');
  });

  it('sends a locked stage to the ladder with "Stage locked"', async () => {
    await open('stage=5', makeSave({ owned: [makeOwned(PIKACHU)], ladder: { cleared: 2 } }));
    expect(nav.replace).toHaveBeenCalledWith('/ladder/?locked=5');
  });

  it('sends an invalid stage to the ladder', async () => {
    await open('stage=banana', makeSave({ owned: [makeOwned(PIKACHU)] }));
    expect(nav.replace).toHaveBeenCalledWith('/ladder/?invalid=1');
  });
});

describe('BattlePage stage battle', () => {
  beforeEach(() => {
    vi.stubEnv('__NEXT_TRAILING_SLASH', 'true');
    __resetSaveStoreForTests();
    nav.push.mockReset();
    nav.replace.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it('previews your team vs the rival with Fight focused', async () => {
    const info = stageInfo(1);
    await open(
      'stage=1',
      makeSave({ owned: [makeOwned(PIKACHU, { level: 5, stars: 2 })], team: [PIKACHU] }),
    );
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      `Stage 1 · Rival ${info.rivalName}`,
    );
    const lineups = screen.getByRole('region', { name: 'Lineups' });
    expect(within(lineups).getByText('Pikachu')).toBeInTheDocument();
    expect(within(lineups).getByText('Lv 5')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fight' })).toHaveFocus();
    expect(screen.getByRole('link', { name: 'Back to ladder' })).toHaveAttribute(
      'href',
      '/ladder/',
    );
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it('asks to fill an empty team first', async () => {
    await open('stage=1', makeSave({ owned: [makeOwned(PIKACHU)], team: [] }));
    const fill = screen.getByRole('button', { name: 'Fill team' });
    expect(fill).toHaveFocus();
    fireEvent.click(fill);
    expect(screen.getByRole('dialog', { name: 'Team' })).toBeInTheDocument();
  });

  it('fights with fighters from the save and the battle seed', async () => {
    const save = makeSave({ owned: [makeOwned(PIKACHU, { level: 7 })], seed: 1234 });
    await open('stage=1', save);
    const arena = await fight();
    expect(arena).toHaveAttribute('data-seed', String(hashSeed(1234, 'battle', 0)));
    expect(arena).toHaveAttribute('data-intro', 'false');
    expect(arena.dataset.red).toBe('Pikachu:7');
    expect(arena.dataset.blue?.split(',')).toHaveLength(1);
  });

  it('commits a win once and offers the next stage', async () => {
    await open('stage=1', makeSave({ owned: [makeOwned(PIKACHU, { level: 5 })] }));
    await fight();
    fireEvent.click(screen.getByRole('button', { name: 'Finish: Red wins' }));

    const save = getSave();
    expect(save?.ladder.cleared).toBe(1);
    expect(save?.meta.battleIndex).toBe(1);
    expect(save?.capsules.basic).toBe(economy.battle.firstClear.capsules.basic);
    expect(save?.dust).toBe(economy.battle.firstClear.dust);

    expect(
      screen.getByRole('heading', { name: 'Victory · First-clear bonus' }),
    ).toBeInTheDocument();
    const next = screen.getByRole('link', { name: 'Next stage' });
    expect(next).toHaveAttribute('href', '/battle/?stage=2');
    expect(next).toHaveFocus();
    expect(screen.getByRole('list', { name: 'Team XP' })).toHaveTextContent('Pikachu');
    expect(screen.getByRole('list', { name: 'Loot' })).toHaveTextContent('+1 Capsule');
    expect(screen.getByRole('link', { name: /Open capsules \(1\)/ })).toHaveAttribute(
      'href',
      '/capsules/',
    );
    expect(screen.getByTestId('arena-status')).toHaveTextContent('Victory. 1 capsule earned.');
    // Still on stage 1 after the win (the stage is cleared, not locked): no redirect.
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it('shows Retry and one suggestion after a defeat, Retry returns to the preview', async () => {
    await open(
      'stage=1',
      makeSave({
        owned: [makeOwned(PIKACHU, { level: 2 }), makeOwned(BULBASAUR, { level: 12 })],
        team: [PIKACHU],
      }),
    );
    await fight();
    fireEvent.click(screen.getByRole('button', { name: 'Finish: Blue wins' }));
    expect(getSave()?.ladder.cleared).toBe(0);
    expect(getSave()?.meta.battleIndex).toBe(1);
    expect(
      screen.getByRole('heading', { name: 'Defeated. Try a stronger lineup.' }),
    ).toBeInTheDocument();
    // A loss pays no loot: no empty loot list.
    expect(screen.queryByRole('list', { name: 'Loot' })).not.toBeInTheDocument();
    expect(screen.getByText('Trainer Pell · Lv 1')).toBeInTheDocument();
    expect(screen.getByText('Bulbasaur is Lv 12 on the bench')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Put in team/ }));
    expect(screen.getByRole('dialog', { name: 'Team' })).toBeInTheDocument();

    const retry = screen.getByRole('button', { name: 'Retry' });
    fireEvent.click(retry);
    expect(screen.queryByTestId('arena')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fight' })).toHaveFocus();
  });

  it('focuses the result’s primary without scrolling the overlay away from the outcome', async () => {
    await open('stage=1', makeSave({ owned: [makeOwned(PIKACHU, { level: 5 })] }));
    await fight();
    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');
    const focus = vi.spyOn(HTMLElement.prototype, 'focus');
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Finish: Blue wins' }));
      const retry = screen.getByRole('button', { name: 'Retry' });
      expect(retry).toHaveFocus();
      expect(focus.mock.contexts).toContain(retry);
      const call = focus.mock.contexts.indexOf(retry);
      expect(focus.mock.calls[call]).toEqual([{ preventScroll: true }]);
      expect(scroll).not.toHaveBeenCalled();
    } finally {
      scroll.mockRestore();
      focus.mockRestore();
    }
  });

  it('opens the level-up dialog when the trainer levels, and Fill slot opens the team', async () => {
    const level = economy.trainer.teamSlots.find((e) => e.slots === 2)?.level ?? 3;
    await open(
      'stage=1',
      makeSave({
        owned: [makeOwned(PIKACHU, { level: 5 }), makeOwned(BULBASAUR)],
        team: [PIKACHU],
        trainer: { level: level - 1, xp: xpToNextTrainerLevel(level - 1) - 1 },
      }),
    );
    await fight();
    fireEvent.click(screen.getByRole('button', { name: 'Finish: Red wins' }));
    const dialog = await screen.findByRole('dialog', { name: `Trainer Lv ${level}` });
    expect(within(dialog).getByText('Team slot 2')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Fill slot 2' }));
    const team = await screen.findByRole('dialog', { name: 'Team' });
    expect(team.querySelector('[data-highlight]')).toHaveAttribute('data-slot-state', 'empty');
  });
});

describe('BattlePage intro', () => {
  beforeEach(() => {
    vi.stubEnv('__NEXT_TRAILING_SLASH', 'true');
    __resetSaveStoreForTests();
    nav.push.mockReset();
    nav.replace.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  const intro = (
    step: 'dealt' | 'fought' | 'capsule',
    extra: Parameters<typeof makeSave>[0] = {},
  ) =>
    makeSave({
      owned: [],
      team: [],
      ...extra,
      onboarding: { step, loanerSpeciesId: PIKACHU, rivalSpeciesId: RATTATA },
    });

  it('dealt → fought → capsule → done: one reward, then the first Pokémon joins the team', async () => {
    await open('stage=intro', intro('dealt'));
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('First battle');
    const arena = await screen.findByTestId('arena');
    expect(arena).toHaveAttribute('data-intro', 'true');
    expect(arena.dataset.red).toBe(`Pikachu:${economy.onboarding.loanerLevel}`);
    expect(arena.dataset.blue).toBe(`Rattata:${economy.onboarding.rivalLevel}`);

    const scroll = vi.spyOn(Element.prototype, 'scrollIntoView');
    fireEvent.click(screen.getByRole('button', { name: 'Finish: Red wins' }));
    // The result focuses "Open capsule" without scrolling "Victory" out of view.
    expect(within(arena).getByRole('button', { name: 'Open capsule' })).toHaveFocus();
    expect(scroll).not.toHaveBeenCalled();
    scroll.mockRestore();
    expect(getSave()?.onboarding.step).toBe('fought');
    expect(getSave()?.capsules.basic).toBe(economy.onboarding.introReward.capsules.basic);
    expect(screen.getByRole('heading', { name: 'Victory' })).toBeInTheDocument();
    expect(screen.getByTestId('arena-status')).toHaveTextContent('Victory. 1 capsule earned.');

    fireEvent.click(within(arena).getByRole('button', { name: 'Open capsule' }));
    expect(getSave()?.onboarding.step).toBe('capsule');
    expect(getSave()?.capsules.basic).toBe(0);
    const owned = Object.keys(getSave()?.collection ?? {}).map(Number);
    expect(owned).toHaveLength(1);
    expect(screen.getByRole('dialog', { name: 'Capsule' })).toBeInTheDocument();

    fireEvent.click(within(arena).getByRole('button', { name: 'Add to team' }));
    expect(getSave()?.team).toEqual(owned);
    expect(getSave()?.onboarding.step).toBe('done');
    expect(nav.push).toHaveBeenCalledWith('/');
  });

  it('resumes at fought without fighting again', async () => {
    await open(
      'stage=intro',
      intro('fought', { capsules: { basic: economy.onboarding.introReward.capsules.basic } }),
    );
    expect(screen.queryByTestId('arena')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Victory' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open capsule' })).toHaveFocus();
    const before = getSave()?.meta.battleIndex;
    fireEvent.click(screen.getByRole('button', { name: 'Open capsule' }));
    expect(getSave()?.onboarding.step).toBe('capsule');
    expect(getSave()?.meta.battleIndex).toBe(before);
  });

  it('resumes at capsule with the first owned Pokémon', async () => {
    await open(
      'stage=intro',
      intro('capsule', {
        owned: [makeOwned(BULBASAUR, { obtainedAt: 5 }), makeOwned(PIKACHU, { obtainedAt: 9 })],
      }),
    );
    expect(screen.queryByTestId('arena')).not.toBeInTheDocument();
    expect(screen.getByText('New! Bulbasaur joined your collection.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Add to team' }));
    expect(getSave()?.team).toEqual([BULBASAUR]);
    expect(getSave()?.onboarding.step).toBe('done');
    expect(nav.push).toHaveBeenCalledWith('/');
  });

  it('treats fought with the capsule already opened as capsule', async () => {
    await open('stage=intro', intro('fought', { owned: [makeOwned(BULBASAUR)] }));
    expect(screen.getByRole('button', { name: 'Add to team' })).toBeInTheDocument();
  });

  it('re-picks an unbeatable rival and writes it back to the save', async () => {
    await open(
      'stage=intro',
      makeSave({
        owned: [],
        team: [],
        onboarding: { step: 'dealt', loanerSpeciesId: RATTATA, rivalSpeciesId: 92 },
      }),
    );
    await screen.findByTestId('arena');
    await waitFor(() => expect(getSave()?.onboarding.rivalSpeciesId).not.toBe(92));
  });
});
