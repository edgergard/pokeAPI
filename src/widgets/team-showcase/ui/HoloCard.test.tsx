// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { RARITY_LABEL } from '@/entities/capsule';
import { getCreatureArt, getSpecies } from '@/entities/pokemon';
import { HoloCard, holoCardLabel } from './HoloCard';

beforeAll(() => {
  // usePointerTilt reads matchMedia (absent in jsdom).
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

describe('HoloCard', () => {
  beforeEach(() => vi.stubEnv('__NEXT_TRAILING_SLASH', 'true'));
  afterEach(() => vi.unstubAllEnvs());

  it('large: art from getCreatureArt, name, level, tag and types', () => {
    const species = getSpecies(25);
    render(
      <HoloCard
        variant="large"
        speciesId={25}
        level={5}
        tag={{ label: 'Loaner', tone: 'loaner' }}
      />,
    );
    const rarity = species ? RARITY_LABEL[species.rarity] : '';
    const card = screen.getByRole('img', { name: `${species?.name}, loaner, level 5, ${rarity}` });
    expect(card).toHaveTextContent('Loaner');
    expect(card).toHaveTextContent('Lv 5');
    expect(card.querySelector('img')).toHaveAttribute('src', getCreatureArt(25, 'artwork'));
  });

  it('mini: links to the creature, names stars, rarity and unspent talent points', () => {
    render(
      <HoloCard
        variant="mini"
        speciesId={1}
        level={7}
        stars={2}
        talentPoints={1}
        href="/creature/?id=1"
      />,
    );
    const link = screen.getByRole('link', {
      name: 'Bulbasaur, level 7, 2 stars, Common, 1 talent point available',
    });
    expect(link).toHaveAttribute('href', '/creature/?id=1');
  });

  it('shows a type-coloured silhouette and a retry button when the art fails', () => {
    const { container } = render(<HoloCard variant="mini" speciesId={4} level={1} stars={1} />);
    const img = container.querySelector('img');
    if (!img) throw new Error('no img');
    fireEvent.error(img);
    expect(container.querySelector('[data-art="silhouette"]')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading Charmander image' }));
    expect(container.querySelector('img')).toHaveAttribute('src', getCreatureArt(4, 'artwork'));
    expect(screen.queryByRole('button', { name: /Retry/ })).not.toBeInTheDocument();
  });

  it('locked: says why in text', () => {
    render(<HoloCard variant="locked" slot={3} unlockLevel={5} />);
    const slot = screen.getByRole('group', { name: 'Slot 3, unlocks at Trainer level 5' });
    expect(slot).toHaveTextContent('Unlocks at Trainer Lv 5');
  });

  it('slot: an open empty slot', () => {
    render(<HoloCard variant="slot" slot={2} />);
    expect(screen.getByRole('group', { name: 'Slot 2, empty' })).toHaveTextContent('Empty slot');
  });
});

describe('holoCardLabel', () => {
  it('builds the spoken summary', () => {
    expect(
      holoCardLabel({ name: 'Pikachu', level: 7, stars: 1, rarity: 'Uncommon', talentPoints: 2 }),
    ).toBe('Pikachu, level 7, 1 star, Uncommon, 2 talent points available');
    expect(
      holoCardLabel({ name: 'Rattata', level: 3, tag: { label: 'Rival', tone: 'rival' } }),
    ).toBe('Rattata, rival, level 3');
  });
});
