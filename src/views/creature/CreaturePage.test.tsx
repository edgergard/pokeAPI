// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { craftPrice } from '@/entities/capsule';
import { getSpecies, SPECIES_COUNT, type Species } from '@/entities/pokemon';
import { levelCap, statBreakdown, xpToNextLevel } from '@/entities/progression';
import { createNewSave, getSave, initSave, type OwnedPokemon, type Save } from '@/entities/save';
import { __resetSaveStoreForTests } from '@/entities/save/model/store';
import { economy } from '@/shared/config/economy';
import { CreaturePage } from './CreaturePage';
import { polyfillDom } from './testDom';

const nav = vi.hoisted(() => ({ query: 'id=25' }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(nav.query),
  useRouter: () => ({ push: () => {} }),
}));

const craftMock = vi.hoisted(() => ({ fail: false }));
vi.mock('@/features/open-capsule', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/features/open-capsule')>();
  return {
    ...actual,
    useCraft: () => {
      const real = actual.useCraft();
      return {
        craft: (speciesId: number) =>
          craftMock.fail
            ? { ok: false as const, reason: 'failed' as const }
            : real.craft(speciesId),
      };
    },
  };
});

beforeAll(polyfillDom);

function species(id: number): Species {
  const s = getSpecies(id);
  if (!s) throw new Error(`no species ${id}`);
  return s;
}

function owned(speciesId: number, patch: Partial<OwnedPokemon> = {}): OwnedPokemon {
  return {
    speciesId,
    level: 1,
    xp: 0,
    stars: 1,
    dupes: 0,
    ivs: { hp: 31, attack: 31, defense: 31, specialAttack: 31, specialDefense: 31, speed: 31 },
    nature: 'neutral',
    talents: [],
    obtainedAt: 0,
    ...patch,
  };
}

function testSave(patch: Partial<Save> = {}): Save {
  const save = createNewSave({ seed: 1, now: 0, name: 'Test' });
  return {
    ...save,
    onboarding: { ...save.onboarding, step: 'done' },
    collection: { '25': owned(25, { level: 12, stars: 2, dupes: 1, xp: 7 }), '4': owned(4) },
    ...patch,
  };
}

async function load(save: Save) {
  await act(() =>
    initSave(
      { durable: true, load: async () => ({ kind: 'loaded', save }), write: async () => true },
      () => save,
    ),
  );
}

async function show(id: string, save: Save = testSave()) {
  nav.query = `id=${id}`;
  render(<CreaturePage />);
  await load(save);
}

const status = () => screen.getByTestId('creature-status');

describe('CreaturePage', () => {
  beforeEach(() => {
    vi.stubEnv('__NEXT_TRAILING_SLASH', 'true');
    __resetSaveStoreForTests();
    craftMock.fail = false;
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('shows a skeleton under the species name while the save loads', () => {
    nav.query = 'id=25';
    render(<CreaturePage />);
    expect(screen.getByRole('main')).toHaveAttribute('id', 'content');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Pikachu');
    expect(screen.getByRole('status', { name: 'Loading Pokémon' })).toBeInTheDocument();
  });

  it.each([['abc'], ['99999'], ['0'], ['2.5']])(
    'says "No Pokémon #%s" for an invalid id, with a link to the collection',
    async (id) => {
      await show(id);
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(`No Pokémon #${id}`);
      expect(screen.getByRole('link', { name: 'Go to Collection' })).toHaveAttribute(
        'href',
        '/collection/',
      );
    },
  );

  it('handles a missing id', async () => {
    nav.query = '';
    render(<CreaturePage />);
    await load(testSave());
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('No Pokémon selected');
  });

  it('shows level / cap with an XP bar and the duplicates to the next star', async () => {
    await show('25');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Pikachu');
    expect(screen.getByText(`/ ${levelCap(2)}`)).toBeInTheDocument();
    const need = xpToNextLevel(species(25), 12);
    const xp = screen.getByRole('progressbar', { name: 'Pikachu XP to level 13' });
    expect(xp).toHaveAttribute('aria-valuenow', '7');
    expect(xp).toHaveAttribute('aria-valuemax', String(need));
    const left = economy.pokemon.dupesForNextStar[2] ?? 0;
    expect(
      screen.getByText(`${left - 1} more duplicate${left - 1 === 1 ? '' : 's'} to ★3`),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: '2 of 5 stars' }).length).toBeGreaterThan(0);
  });

  it('says how to raise the cap at the level cap, and hides dupes at max stars', async () => {
    const cap = levelCap(2);
    await show('25', testSave({ collection: { '25': owned(25, { level: cap, stars: 2 }) } }));
    expect(screen.getByTestId('cap-message')).toHaveTextContent(
      `Level cap ${cap}. Earn ★3 to raise it.`,
    );
    expect(screen.queryByRole('progressbar', { name: /XP to level/ })).not.toBeInTheDocument();
  });

  it('shows stats base → current from statBreakdown', async () => {
    await show('25');
    const lines = statBreakdown(species(25), owned(25, { level: 12, stars: 2 }));
    const attack = screen.getByRole('row', { name: /^Attack/ });
    const cells = within(attack)
      .getAllByRole('cell')
      .map((c) => c.textContent);
    expect(cells[0]).toBe(String(lines.attack.base));
    expect(cells[1]).toBe(String(lines.attack.formula));
    expect(cells[3]).toContain(String(lines.attack.current));
  });

  it('learns a talent, updates its node and announces the stat change; Reset refunds it', async () => {
    const user = userEvent.setup();
    await show('25');
    const pikachu = owned(25, { level: 12, stars: 2, dupes: 1, xp: 7 });
    const before = statBreakdown(species(25), pikachu).attack.current;
    const after = statBreakdown(species(25), pikachu, ['offense-1']).attack.current;

    expect(screen.getByText('2 points available')).toBeInTheDocument();
    const tier2 = screen.getByRole('button', { name: 'Focused Mind' });
    expect(tier2).toHaveAttribute('aria-disabled', 'true');
    expect(tier2).toHaveAccessibleDescription(/Requires: Honed Strikes/);

    const node = screen.getByRole('button', { name: 'Honed Strikes' });
    expect(node).toHaveAttribute('aria-pressed', 'false');
    await user.click(node);
    expect(node).toHaveAttribute('aria-pressed', 'true');
    expect(getSave()?.collection['25']?.talents).toEqual(['offense-1']);
    expect(status()).toHaveTextContent(`Attack ${before} → ${after}`);
    expect(screen.getByText('1 point available')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Focused Mind' })).not.toHaveAttribute(
      'aria-disabled',
    );

    await user.click(screen.getByRole('button', { name: 'Reset talents · free' }));
    expect(getSave()?.collection['25']?.talents).toEqual([]);
    expect(status()).toHaveTextContent(`Talents reset. Attack ${after} → ${before}`);
    expect(screen.getByRole('button', { name: 'Honed Strikes' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('locks talents before the first point with "First talent point at Lv 5"', async () => {
    await show('25', testSave({ collection: { '25': owned(25, { level: 3 }) } }));
    const node = screen.getByRole('button', { name: 'Honed Strikes' });
    expect(node).toHaveAttribute('aria-disabled', 'true');
    expect(node).toHaveAccessibleDescription(
      new RegExp(`First talent point at Lv ${economy.pokemon.talentPointEveryLevels}`),
    );
    expect(screen.getByText('0 points available')).toBeInTheDocument();
  });

  it('adds to the team while a slot is free, then shows "In team ✓"', async () => {
    const user = userEvent.setup();
    await show('25');
    const add = screen.getByRole('button', { name: 'Add to team' });
    await user.click(add);
    expect(getSave()?.team).toEqual([25]);
    expect(add).toHaveTextContent('In team ✓');
    expect(add).toHaveAttribute('aria-disabled', 'true');
    expect(add).toHaveFocus();
    expect(status()).toHaveTextContent('Pikachu joined your team.');
  });

  it('refuses a full team with the reason and a link to the Ladder', async () => {
    const user = userEvent.setup();
    // Trainer Lv 1 has one slot, taken by Charmander.
    await show('25', testSave({ team: [4] }));
    const add = screen.getByRole('button', { name: 'Add to team' });
    expect(add).toHaveAttribute('aria-disabled', 'true');
    expect(add).toHaveAccessibleDescription('Team is full. Edit your team on the Ladder to swap.');
    expect(screen.getByRole('link', { name: 'Open Ladder' })).toHaveAttribute('href', '/ladder/');
    await user.click(add);
    expect(getSave()?.team).toEqual([4]);
  });

  it('crafts an unowned species with dust and reveals it', async () => {
    const user = userEvent.setup();
    const price = craftPrice(species(1).rarity);
    await show('1', testSave({ dust: price + 5 }));
    expect(
      screen.getByRole('article', { name: /Bulbasaur.*not in your collection/ }),
    ).toBeInTheDocument();
    const craft = screen.getByRole('button', { name: `Craft for ${price} dust` });
    expect(craft).not.toHaveAttribute('aria-disabled');
    await user.click(craft);
    expect(getSave()?.collection['1']).toBeDefined();
    expect(getSave()?.dust).toBe(5);
    expect(screen.getByRole('dialog', { name: 'Crafted with dust' })).toBeInTheDocument();
    // The page now shows the owned Pokémon behind the reveal.
    expect(screen.getByRole('button', { name: 'Add to team', hidden: true })).toBeInTheDocument();
  });

  it('disables crafting without enough dust: "Need N more dust"', async () => {
    const user = userEvent.setup();
    const price = craftPrice(species(1).rarity);
    await show('1', testSave({ dust: 10 }));
    const craft = screen.getByRole('button', { name: `Craft for ${price} dust` });
    expect(craft).toHaveAttribute('aria-disabled', 'true');
    expect(craft).toHaveAccessibleDescription(`Need ${price - 10} more dust`);
    await user.click(craft);
    expect(getSave()?.collection['1']).toBeUndefined();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('says "Couldn\'t craft. Try again" when the craft fails', async () => {
    const user = userEvent.setup();
    craftMock.fail = true;
    const price = craftPrice(species(1).rarity);
    await show('1', testSave({ dust: price }));
    await user.click(screen.getByRole('button', { name: `Craft for ${price} dust` }));
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't craft. Try again");
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('links to the previous and next species, wrapping at the ends', async () => {
    await show('25');
    expect(screen.getByRole('link', { name: 'Previous: #024 Arbok' })).toHaveAttribute(
      'href',
      '/creature/?id=24',
    );
    expect(screen.getByRole('link', { name: 'Next: #026 Raichu' })).toHaveAttribute(
      'href',
      '/creature/?id=26',
    );
  });

  it('keeps focus on the Next link when the id changes', async () => {
    nav.query = 'id=25';
    const { rerender } = render(<CreaturePage />);
    await load(testSave());
    const next = screen.getByRole('link', { name: 'Next: #026 Raichu' });
    next.focus();
    nav.query = 'id=26';
    rerender(<CreaturePage />);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Raichu');
    expect(next).toHaveFocus();
    expect(next).toHaveAttribute('href', '/creature/?id=27');
  });

  it('counts the collection like the Collection screen (baked species only)', async () => {
    const save = testSave();
    await show('25', { ...save, collection: { ...save.collection, '99999': owned(99999) } });
    expect(screen.getByRole('link', { name: `Collection 2 / ${SPECIES_COUNT}` })).toHaveAttribute(
      'href',
      '/collection/',
    );
  });

  it('wraps from #001 back to the last species', async () => {
    await show('1');
    expect(
      screen.getByRole('link', { name: new RegExp(`^Previous: #${SPECIES_COUNT}`) }),
    ).toHaveAttribute('href', `/creature/?id=${SPECIES_COUNT}`);
  });

  it('shows the battle moveset', async () => {
    await show('25');
    expect(await screen.findByText('Thunderbolt')).toBeInTheDocument();
  });
});
