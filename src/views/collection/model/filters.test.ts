import { describe, expect, it } from 'vitest';
import { rarityRank } from '@/entities/capsule';
import { allSpecies, getSpecies, SPECIES_COUNT } from '@/entities/pokemon';
import type { OwnedPokemon, Save } from '@/entities/save';
import {
  DEFAULT_FILTERS,
  SPECIES_GENERATIONS,
  SPECIES_TYPES,
  filterSpecies,
  hasActiveFilters,
  searchModeFor,
  sortSpecies,
} from './filters';

function owned(speciesId: number, patch: Partial<OwnedPokemon> = {}): OwnedPokemon {
  return {
    speciesId,
    level: 1,
    xp: 0,
    stars: 1,
    dupes: 0,
    ivs: { hp: 0, attack: 0, defense: 0, specialAttack: 0, specialDefense: 0, speed: 0 },
    nature: 'neutral',
    talents: [],
    obtainedAt: 0,
    ...patch,
  };
}

const collection: Save['collection'] = {
  '25': owned(25, { level: 12, stars: 2 }),
  '4': owned(4, { level: 12, stars: 3 }),
  '150': owned(150, { level: 30 }),
};

describe('collection filters', () => {
  it('derives 18 types and the generations from the species data', () => {
    expect(SPECIES_TYPES).toHaveLength(18);
    expect(SPECIES_GENERATIONS[0]).toBe(1);
    expect(SPECIES_GENERATIONS).toEqual([...SPECIES_GENERATIONS].sort((a, b) => a - b));
  });

  it('shows everything by default', () => {
    expect(filterSpecies(allSpecies, collection, DEFAULT_FILTERS)).toHaveLength(SPECIES_COUNT);
    expect(hasActiveFilters(DEFAULT_FILTERS)).toBe(false);
  });

  it('narrows by ownership', () => {
    const ownedOnly = filterSpecies(allSpecies, collection, {
      ...DEFAULT_FILTERS,
      ownership: 'owned',
    });
    expect(ownedOnly.map((s) => s.id)).toEqual([4, 25, 150]);
    const missing = filterSpecies(allSpecies, collection, {
      ...DEFAULT_FILTERS,
      ownership: 'missing',
    });
    expect(missing).toHaveLength(SPECIES_COUNT - 3);
    expect(missing.some((s) => s.id === 25)).toBe(false);
  });

  it('narrows by type, rarity, generation and search together', () => {
    const fire = filterSpecies(allSpecies, collection, { ...DEFAULT_FILTERS, type: 'fire' });
    expect(fire.every((s) => s.types.includes('fire'))).toBe(true);
    expect(fire.some((s) => s.id === 4)).toBe(true);

    const legendary = filterSpecies(allSpecies, collection, {
      ...DEFAULT_FILTERS,
      rarity: 'legendary',
    });
    expect(legendary.length).toBeGreaterThan(0);
    expect(legendary.every((s) => s.rarity === 'legendary')).toBe(true);

    const gen2 = filterSpecies(allSpecies, collection, { ...DEFAULT_FILTERS, generation: 2 });
    expect(gen2.every((s) => s.generation === 2)).toBe(true);

    const combined = filterSpecies(allSpecies, collection, {
      ...DEFAULT_FILTERS,
      generation: 1,
      type: 'fire',
      query: 'char',
    });
    expect(combined.map((s) => s.id)).toEqual([4, 5, 6]);
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, query: ' x ' })).toBe(true);
  });

  it('searches by dex number', () => {
    expect(
      filterSpecies(allSpecies, collection, { ...DEFAULT_FILTERS, query: '#025' }).map((s) => s.id),
    ).toEqual([25]);
  });

  it('sorts by dex number, by level (owned first) and by rarity', () => {
    const picked = [150, 25, 1, 4].map((id) => getSpecies(id)).filter((s) => s !== undefined);
    expect(sortSpecies(picked, collection, 'dex').map((s) => s.id)).toEqual([1, 4, 25, 150]);
    // Lv 30, then the Lv 12 pair by stars, then the missing one.
    expect(sortSpecies(picked, collection, 'level').map((s) => s.id)).toEqual([150, 4, 25, 1]);
    const byRarity = sortSpecies(allSpecies, collection, 'rarity');
    for (let i = 1; i < byRarity.length; i++) {
      const prev = byRarity[i - 1];
      const cur = byRarity[i];
      if (!prev || !cur) continue;
      expect(rarityRank(prev.rarity)).toBeGreaterThanOrEqual(rarityRank(cur.rarity));
    }
  });

  it('maps ownership to a search mode', () => {
    expect(searchModeFor('missing')).toBe('unowned');
    expect(searchModeFor('owned')).toBe('owned');
    expect(searchModeFor('all')).toBe('all');
  });
});
