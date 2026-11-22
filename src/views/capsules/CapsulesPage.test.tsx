// @vitest-environment jsdom
// Typed jest-dom matchers (vitest.setup.ts registers them at runtime but is outside tsconfig).
import '@testing-library/jest-dom/vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { rollCapsule } from '@/entities/capsule';
import { owned, testSave } from '@/entities/capsule/model/testSave';
import { getSave, initSave, registerGameEventReducer, type Save } from '@/entities/save';
import { __resetSaveStoreForTests } from '@/entities/save/model/store';
import { economy } from '@/shared/config/economy';
import { polyfillDom } from '@/widgets/capsule-reveal/ui/testDom';
import { CapsulesPage } from './CapsulesPage';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

beforeAll(polyfillDom);

/** Lets a test make the next commit fail inside updateSave. */
let failCommits = false;
registerGameEventReducer((save) => {
  if (failCommits) throw new Error('boom');
  return save;
});

async function load(save: Save) {
  await act(() =>
    initSave(
      { durable: true, load: async () => ({ kind: 'loaded', save }), write: async () => true },
      () => save,
    ),
  );
}

describe('CapsulesPage', () => {
  beforeEach(() => {
    // Mirrors next.config.ts `trailingSlash: true` (next/link reads it from the env at call time).
    vi.stubEnv('__NEXT_TRAILING_SLASH', 'true');
    __resetSaveStoreForTests();
    push.mockReset();
    failCommits = false;
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('renders one h1, a skeleton and the odds while the save loads', () => {
    render(<CapsulesPage />);
    expect(screen.getByRole('main')).toHaveAttribute('id', 'content');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Capsules');
    expect(screen.getByRole('status', { name: 'Loading capsules' })).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('explains a failed save load without fake pity numbers', async () => {
    render(<CapsulesPage />);
    await act(() =>
      initSave(
        {
          durable: true,
          load: async () => ({ kind: 'error', reason: 'corrupt' }),
          write: async () => true,
        },
        () => testSave(),
      ),
    );
    expect(screen.getByRole('link', { name: 'Go to Home' })).toHaveAttribute('href', '/');
    expect(screen.getByText(/^Pity unavailable/)).toBeInTheDocument();
    expect(screen.queryByTestId('pity-skeleton')).not.toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Loading capsules' })).not.toBeInTheDocument();
  });

  it('shows the empty state with a Fight link to the next ladder stage', async () => {
    render(<CapsulesPage />);
    await load(testSave({ ladder: { cleared: 3, replayWins: 0 } }));
    expect(
      screen.getByText('No capsules. Win battles and finish daily quests to earn them.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Fight' })).toHaveAttribute('href', '/battle/?stage=4');
    expect(screen.queryByRole('button', { name: /^Open/ })).not.toBeInTheDocument();
  });

  it('caps the Fight link at the last ladder stage', async () => {
    const last = economy.battle.ladderStages;
    render(<CapsulesPage />);
    await load(testSave({ ladder: { cleared: last, replayWins: 0 } }));
    expect(screen.getByRole('link', { name: 'Fight' })).toHaveAttribute(
      'href',
      `/battle/?stage=${last}`,
    );
  });

  it('locks Great capsules below the unlock level and offers "Open all" only at 2+', async () => {
    render(<CapsulesPage />);
    await load(testSave({ capsules: { basic: 1, great: 2 } }));
    const stacks = screen.getByRole('list', { name: 'Your capsules' });
    const great = within(stacks).getByText('Great capsule').closest('li');
    if (!great) throw new Error('no great stack');
    expect(great).toHaveTextContent(
      `Great capsules unlock at Trainer Lv ${economy.trainer.unlocks.greatCapsules}`,
    );
    expect(within(great).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open 1 Basic capsule' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Open all/ })).not.toBeInTheDocument();
  });

  it('shows "Open all" for a tier with 2 or more and opens Great once unlocked', async () => {
    render(<CapsulesPage />);
    await load(
      testSave({
        capsules: { basic: 3, great: 2 },
        trainer: { level: economy.trainer.unlocks.greatCapsules },
      }),
    );
    expect(screen.getByRole('button', { name: 'Open all 3 Basic capsules' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open all 2 Great capsules' })).toBeInTheDocument();
    expect(screen.getAllByRole('progressbar')).toHaveLength(2);
  });

  it('commits the roll before the reveal animates, then offers "View new"', async () => {
    render(<CapsulesPage />);
    await load(testSave({ capsules: { basic: 2, great: 0 } }));
    fireEvent.click(screen.getByRole('button', { name: 'Open 1 Basic capsule' }));

    // Saved while the capsule is still shaking.
    const dialog = screen.getByRole('dialog', { name: 'Capsule' });
    expect(dialog.querySelector('[data-reveal-phase]')).toHaveAttribute(
      'data-reveal-phase',
      'charge',
    );
    const save = getSave();
    expect(save?.capsules.basic).toBe(1);
    expect(save?.meta.pullIndex).toBe(1);
    const [id] = Object.keys(save?.collection ?? {});

    fireEvent.click(within(dialog).getByRole('button', { name: /skip/i }));
    expect(within(dialog).getByText(/^New! .+ joined your collection\.$/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Open next' })).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'View new' }));
    expect(push).toHaveBeenCalledWith(`/creature/?id=${id}`);
  });

  it('says "Done" when nothing new dropped', async () => {
    // The species a pull rolls never depends on the collection: learn it, then own it beforehand.
    const base = testSave({ capsules: { basic: 1, great: 0 } });
    const { speciesId } = rollCapsule(base, 'basic', 0).result;
    render(<CapsulesPage />);
    await load({ ...base, collection: { [String(speciesId)]: owned(speciesId) } });
    fireEvent.click(screen.getByRole('button', { name: 'Open 1 Basic capsule' }));
    const dialog = screen.getByRole('dialog', { name: 'Capsule' });
    fireEvent.click(within(dialog).getByRole('button', { name: /skip/i }));
    expect(within(dialog).getByText(/★ up!/)).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Done' })).toBeInTheDocument();
    // That was the last capsule: nothing to open next.
    expect(within(dialog).queryByRole('button', { name: 'Open next' })).not.toBeInTheDocument();
  });

  it('shows "Couldn\'t open. Try again" when the open fails, and leaves the save alone', async () => {
    const before = testSave({ capsules: { basic: 1, great: 0 } });
    render(<CapsulesPage />);
    await load(before);
    failCommits = true;
    fireEvent.click(screen.getByRole('button', { name: 'Open 1 Basic capsule' }));
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't open. Try again");
    expect(getSave()).toBe(before);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    failCommits = false;
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Capsule' })).toBeInTheDocument();
  });

  it('disables crafting without enough dust and says how much is missing', async () => {
    const price = economy.dust.craftPrice.common; // #1 Bulbasaur is common
    render(<CapsulesPage />);
    await load(testSave({ dust: price - 40 }));
    const craft = screen.getByRole('button', { name: 'Craft with dust: Bulbasaur' });
    expect(craft).toHaveAttribute('aria-disabled', 'true');
    expect(craft).toHaveAccessibleDescription('Need 40 more dust');
    fireEvent.click(craft);
    expect(getSave()?.dust).toBe(price - 40);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('crafts an unowned Pokémon with dust and reveals it as a single new card', async () => {
    const price = economy.dust.craftPrice.common;
    render(<CapsulesPage />);
    await load(testSave({ dust: price + 5 }));
    fireEvent.change(screen.getByLabelText('Search unowned Pokémon'), {
      target: { value: 'bulba' },
    });
    const craft = await screen.findByRole('button', { name: 'Craft with dust: Bulbasaur' });
    expect(craft).not.toHaveAttribute('aria-disabled');
    fireEvent.click(craft);

    expect(getSave()?.dust).toBe(5);
    expect(getSave()?.collection['1']).toBeDefined();
    const dialog = screen.getByRole('dialog', { name: 'Crafted with dust' });
    fireEvent.click(within(dialog).getByRole('button', { name: /skip/i }));
    expect(within(dialog).getByText('New! Bulbasaur joined your collection.')).toBeInTheDocument();
    // The crafted species leaves the unowned list.
    expect(
      screen.queryByRole('button', { name: 'Craft with dust: Bulbasaur' }),
    ).not.toBeInTheDocument();
  });

  it('lists only unowned species', async () => {
    render(<CapsulesPage />);
    await load(testSave({ collection: { '25': owned(25) } }));
    fireEvent.change(screen.getByLabelText('Search unowned Pokémon'), {
      target: { value: 'pikachu' },
    });
    expect(await screen.findByText('No unowned Pokémon match this search')).toBeInTheDocument();
  });
});
