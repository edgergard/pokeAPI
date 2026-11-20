import { describe, expect, it, vi } from 'vitest';
import type { PokemonListItem } from '@/entities/pokemon';
import { PRESET_TRAINERS } from './presets';
import { randomRival } from './randomRival';
import { LEGACY_TRAINER_KEY, ROSTER_KEY, loadRoster, parseRoster, type Trainer } from './roster';

const valid: Trainer = { id: 'a', firstName: 'Ash', lastName: 'K', team: ['pikachu', 'eevee', 'snorlax', 'mew'], savedAt: '2026-02-01T00:00:00.000Z' };
const legacy = { firstName: 'Old', lastName: 'Timer', team: ['bulbasaur', 'charmander', 'squirtle', 'pidgey'], savedAt: '2025-01-01T00:00:00.000Z' };

function fakeStorage(items: Record<string, string>) {
  return { getItem: (k: string) => items[k] ?? null, removeItem: vi.fn() };
}

/** Tiny seeded generator (mulberry32) so the test needs nothing from other entities. */
function createSeq(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('roster', () => {
  it('parseRoster drops invalid entries instead of throwing', () => {
    expect(parseRoster('nope')).toEqual([]);
    expect(parseRoster([{ id: 'a2', firstName: 'A', lastName: 'B', team: ['x', 'y'], savedAt: '2026' }, valid])).toEqual([valid]);
    expect(parseRoster([{ ...valid, team: ['a', 'a', 'b', 'c'] }])).toEqual([]);
  });

  it('migrates the legacy single trainer once and removes the legacy key', () => {
    const store = fakeStorage({ [LEGACY_TRAINER_KEY]: JSON.stringify(legacy) });
    const roster = loadRoster(store);
    expect(roster).toHaveLength(1);
    expect(roster[0]).toMatchObject({ firstName: legacy.firstName, team: legacy.team });
    expect(roster[0]?.id).toBeTruthy();
    expect(store.removeItem).toHaveBeenCalledWith(LEGACY_TRAINER_KEY);
  });

  it('merges the stored roster with a legacy trainer', () => {
    const store = fakeStorage({ [ROSTER_KEY]: JSON.stringify([valid]), [LEGACY_TRAINER_KEY]: JSON.stringify(legacy) });
    expect(loadRoster(store).map((t) => t.firstName)).toEqual(['Ash', 'Old']);
  });

  it('survives non-JSON in either key', () => {
    expect(loadRoster(fakeStorage({ [ROSTER_KEY]: '{oops', [LEGACY_TRAINER_KEY]: '][' }))).toEqual([]);
  });

  it('presets are 4 valid trainers with distinct ids and default-form teams', () => {
    expect(parseRoster(PRESET_TRAINERS)).toHaveLength(4);
    expect(PRESET_TRAINERS.every((t) => t.id.startsWith('preset-'))).toBe(true);
  });

  it('randomRival picks 4 distinct default-form Pokémon deterministically for a seeded rng', () => {
    const index: PokemonListItem[] = Array.from({ length: 1200 }, (_, i) => ({ id: i < 1025 ? i + 1 : 10001 + i, name: `p${i}` }));
    const a = randomRival(index, createSeq(1));
    const b = randomRival(index, createSeq(1));
    expect(a.team).toEqual(b.team);
    expect(new Set(a.team).size).toBe(4);
    expect(a.team.every((n) => index.find((p) => p.name === n)!.id < 10000)).toBe(true);
    expect(a.id.startsWith('rival-')).toBe(true);
    expect(index).toHaveLength(1200);
  });
});
