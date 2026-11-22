import { describe, expect, it } from 'vitest';
import { allSpecies, getSpecies, type Species } from '@/entities/pokemon';
import { createNewSave, type OwnedPokemon, type Save } from '@/entities/save';
import {
  inSearchMode,
  matchesSpeciesQuery,
  normalizeQuery,
  ownedSpeciesCount,
  searchSpecies,
} from './search';

function owned(speciesId: number): OwnedPokemon {
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
  };
}

function collectionOf(...ids: number[]): Save['collection'] {
  const save = createNewSave({ seed: 1, now: 0, name: 'Test' });
  return Object.fromEntries([
    ...Object.entries(save.collection),
    ...ids.map((id) => [String(id), owned(id)]),
  ]);
}

function species(id: number): Species {
  const s = getSpecies(id);
  if (!s) throw new Error(`no species ${id}`);
  return s;
}

describe('normalizeQuery', () => {
  it('trims, lower-cases and strips accents', () => {
    expect(normalizeQuery('  Flabébé ')).toBe('flabebe');
  });
});

describe('matchesSpeciesQuery', () => {
  it('matches part of the name, case-insensitively', () => {
    expect(matchesSpeciesQuery(species(25), 'KACH')).toBe(true);
    expect(matchesSpeciesQuery(species(25), 'bulba')).toBe(false);
  });

  it('matches an exact dex number, with or without # and leading zeros', () => {
    expect(matchesSpeciesQuery(species(25), '25')).toBe(true);
    expect(matchesSpeciesQuery(species(25), '#025')).toBe(true);
    expect(matchesSpeciesQuery(species(250), '25')).toBe(false);
  });

  it('matches everything on an empty query', () => {
    expect(allSpecies.every((s) => matchesSpeciesQuery(s, '   '))).toBe(true);
  });
});

describe('inSearchMode', () => {
  const collection = collectionOf(25);
  it('splits owned and unowned by the collection keys', () => {
    expect(inSearchMode(collection, 25, 'owned')).toBe(true);
    expect(inSearchMode(collection, 25, 'unowned')).toBe(false);
    expect(inSearchMode(collection, 1, 'owned')).toBe(false);
    expect(inSearchMode(collection, 1, 'unowned')).toBe(true);
    expect(inSearchMode(collection, 1, 'all')).toBe(true);
  });
});

describe('ownedSpeciesCount', () => {
  it('counts owned baked species only, never above SPECIES_COUNT', () => {
    expect(ownedSpeciesCount(collectionOf(1, 4, 25))).toBe(3);
    expect(ownedSpeciesCount({ ...collectionOf(1, 4), '99999': owned(99999) })).toBe(2);
    expect(ownedSpeciesCount({})).toBe(0);
  });
});

describe('searchSpecies', () => {
  const collection = collectionOf(1, 4);

  it('returns nothing for an empty query', () => {
    expect(searchSpecies('  ', { mode: 'all', collection })).toEqual([]);
  });

  it('keeps to the mode', () => {
    const ids = (mode: 'owned' | 'unowned' | 'all') =>
      searchSpecies('a', { mode, collection }).map((s) => s.id);
    expect(ids('owned')).toEqual([1, 4]);
    expect(ids('unowned')).not.toContain(1);
    expect(ids('unowned')).not.toContain(4);
    expect(ids('all')).toEqual(expect.arrayContaining([1, 4]));
  });

  it('ranks names that start with the query first, then by dex number', () => {
    const found = searchSpecies('char', { mode: 'all', collection });
    const starts = found.map((s) => s.name.toLowerCase().startsWith('char'));
    expect(starts.indexOf(false) === -1 || starts.lastIndexOf(true) < starts.indexOf(false)).toBe(
      true,
    );
    expect(found.slice(0, 3).map((s) => s.id)).toEqual([4, 5, 6]);
  });

  it('leaves out excluded ids', () => {
    expect(
      searchSpecies('char', { mode: 'all', collection, exclude: [4] }).map((s) => s.id),
    ).not.toContain(4);
  });
});
