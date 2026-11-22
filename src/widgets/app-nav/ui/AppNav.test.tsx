// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { xpToNextTrainerLevel } from '@/entities/progression';
import { createNewSave, initSave, updateSave, type Save } from '@/entities/save';
import { __resetSaveStoreForTests } from '@/entities/save/model/store';
import { economy } from '@/shared/config/economy';
import { setMotionPreference } from '@/shared/lib/motion';
import { AppNav } from './AppNav';

const nav = vi.hoisted(() => ({ pathname: '/', replace: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => {
  const router = { replace: nav.replace, push: nav.push };
  return { usePathname: () => nav.pathname, useRouter: () => router };
});

beforeAll(() => {
  if (typeof window.matchMedia !== 'function') {
    window.matchMedia = (query: string) =>
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
  }
});

function save(over: Partial<Save> = {}): Save {
  const base = createNewSave({ seed: 7, now: 0, name: 'Rowan' });
  return {
    ...base,
    onboarding: { step: 'done', loanerSpeciesId: 1, rivalSpeciesId: 4 },
    team: [25],
    ...over,
  };
}

async function load(s: Save) {
  await act(() =>
    initSave(
      { durable: true, load: async () => ({ kind: 'loaded', save: s }), write: async () => true },
      () => s,
    ),
  );
}

const sections = () => screen.queryByRole('navigation', { name: 'Sections' });

describe('AppNav', () => {
  beforeEach(() => {
    vi.stubEnv('__NEXT_TRAILING_SLASH', 'true');
    __resetSaveStoreForTests();
    nav.pathname = '/';
    nav.replace.mockReset();
    setMotionPreference('on');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    setMotionPreference('system');
  });

  it('shows only the logo and Motion while the save loads', () => {
    render(<AppNav />);
    const main = screen.getByRole('navigation', { name: 'Main' });
    expect(within(main).getByRole('link', { name: 'Trainer Studio, home' })).toHaveAttribute(
      'href',
      '/',
    );
    expect(within(main).getByRole('group', { name: 'Animations' })).toBeInTheDocument();
    expect(within(main).getAllByRole('link')).toHaveLength(1);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(sections()).not.toBeInTheDocument();
  });

  it('stays minimal during onboarding and sends deep links home', async () => {
    nav.pathname = '/ladder/';
    render(<AppNav />);
    await load(save({ onboarding: { step: 'dealt', loanerSpeciesId: 1, rivalSpeciesId: 4 } }));
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.queryByRole('link', { name: /Fight/ })).not.toBeInTheDocument();
    expect(sections()).not.toBeInTheDocument();
    expect(nav.replace).toHaveBeenCalledWith('/');
  });

  it.each(['/', '/battle/', '/settings/'])('keeps %s open during onboarding', async (path) => {
    nav.pathname = path;
    render(<AppNav />);
    await load(save({ onboarding: { step: 'hero', loanerSpeciesId: null, rivalSpeciesId: null } }));
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it('shows sections, badges, the Lv pill, Fight · Stage N and Settings once onboarding is done', async () => {
    nav.pathname = '/collection/';
    render(<AppNav />);
    const level = 3;
    await load(
      save({
        trainer: { name: 'Rowan', level, xp: 120, talentPoints: 1, talents: [] },
        capsules: { basic: 2, great: 1 },
        ladder: { cleared: 6, replayWins: 0 },
      }),
    );
    const main = screen.getByRole('navigation', { name: 'Main' });
    expect(within(main).getByRole('link', { name: 'Ladder' })).toHaveAttribute('href', '/ladder/');
    expect(within(main).getByRole('link', { name: 'Collection' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(main).getByRole('link', { name: 'Capsules, 3 unopened' })).toHaveAttribute(
      'href',
      '/capsules/',
    );
    expect(
      within(main).getByRole('link', { name: 'Trainer, unspent talent points' }),
    ).toHaveAttribute('href', '/trainer/');
    const xp = within(main).getByRole('progressbar', { name: 'Trainer XP' });
    expect(xp).toHaveAttribute('aria-valuenow', '120');
    expect(xp).toHaveAttribute('aria-valuemax', String(xpToNextTrainerLevel(level)));
    expect(within(main).getByText(`Lv ${level}`)).toBeInTheDocument();
    expect(within(main).getByRole('link', { name: 'Fight · Stage 7' })).toHaveAttribute(
      'href',
      '/battle/?stage=7',
    );
    expect(within(main).getByRole('link', { name: 'Settings' })).toHaveAttribute(
      'href',
      '/settings/',
    );

    const tabs = sections();
    if (!tabs) throw new Error('no tab bar');
    expect(
      within(tabs)
        .getAllByRole('link')
        .map((l) => l.getAttribute('aria-label') ?? l.textContent),
    ).toEqual([
      'Home',
      'Ladder',
      'Collection',
      'Capsules, 3 unopened',
      'Trainer, unspent talent points',
    ]);
    expect(
      within(tabs)
        .getAllByRole('link')
        .every((l) => l.className.includes('min-h-14')),
    ).toBe(true);
    expect(within(tabs).getByRole('link', { name: 'Collection' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(tabs).getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });

  it('caps the Fight stage at the last ladder stage and hides empty badges', async () => {
    render(<AppNav />);
    const last = economy.battle.ladderStages;
    await load(save({ ladder: { cleared: last, replayWins: 0 } }));
    expect(screen.getAllByRole('link', { name: `Fight · Stage ${last}` })).toHaveLength(1);
    expect(screen.getAllByRole('link', { name: 'Capsules' }).length).toBeGreaterThan(0);
    expect(screen.queryByText(/unopened/)).not.toBeInTheDocument();
  });

  it('marks Home current on / (trailing slash ignored)', async () => {
    nav.pathname = '/';
    render(<AppNav />);
    await load(save());
    expect(screen.getByRole('link', { name: 'Trainer Studio, home' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    const tabs = sections();
    expect(tabs && within(tabs).getByRole('link', { name: 'Home' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('pulses Fight once when onboarding finishes while mounted, never on a reload', async () => {
    render(<AppNav />);
    await load(save({ onboarding: { step: 'capsule', loanerSpeciesId: 1, rivalSpeciesId: 4 } }));
    expect(screen.queryByRole('link', { name: /Fight/ })).not.toBeInTheDocument();
    act(() => updateSave((s) => ({ ...s, onboarding: { ...s.onboarding, step: 'done' } })));
    expect(screen.getByRole('link', { name: 'Fight · Stage 1' })).toHaveAttribute(
      'data-pulse',
      '1',
    );
  });

  it('does not pulse on a reload with onboarding already done', async () => {
    render(<AppNav />);
    await load(save());
    expect(screen.getByRole('link', { name: 'Fight · Stage 1' })).not.toHaveAttribute('data-pulse');
  });

  it('does not pulse under reduced motion', async () => {
    setMotionPreference('off');
    render(<AppNav />);
    await load(save({ onboarding: { step: 'capsule', loanerSpeciesId: 1, rivalSpeciesId: 4 } }));
    act(() => updateSave((s) => ({ ...s, onboarding: { ...s.onboarding, step: 'done' } })));
    expect(screen.getByRole('link', { name: 'Fight · Stage 1' })).not.toHaveAttribute('data-pulse');
  });

  it('offers Settings when the save can’t be read', async () => {
    render(<AppNav />);
    await act(() =>
      initSave(
        {
          durable: true,
          load: async () => ({ kind: 'error', reason: 'damaged' }),
          write: async () => true,
        },
        () => save(),
      ),
    );
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings/');
    expect(sections()).not.toBeInTheDocument();
  });
});
