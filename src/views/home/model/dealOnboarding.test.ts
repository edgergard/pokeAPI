import { beforeAll, describe, expect, it, vi } from 'vitest';
import {
  findIntroSeed,
  IntroSeedError,
  loadMovesets,
  movesFor,
  simulateBattle,
  type MovesetData,
} from '@/entities/battle';
import { getSpecies, speciesOfRarity } from '@/entities/pokemon';
import { createNewSave } from '@/entities/save';
import { economy } from '@/shared/config/economy';
import { createRng, hashSeed } from '@/shared/lib/rng';
import {
  buildIntroTeams,
  dealOnboarding,
  loanerPool,
  OnboardingDealError,
  pickLoaner,
  RIVAL_PICK_LIMIT,
  rivalAt,
  rivalCandidates,
} from './dealOnboarding';

/** Lets one test make every intro unwinnable. */
const intro = vi.hoisted(() => ({ fail: false }));
vi.mock('@/entities/battle', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/entities/battle')>();
  return {
    ...actual,
    findIntroSeed: (...args: Parameters<typeof actual.findIntroSeed>) => {
      if (intro.fail) throw new actual.IntroSeedError('red', 'blue', 1);
      return actual.findIntroSeed(...args);
    },
  };
});

const saveWithSeed = (seed: number) => createNewSave({ seed, now: 0, name: 'Tester' });

/** A seed whose first rival (k = 0) can't be beaten, so the deal moves on to k = 1. */
const REPICK_SEED = 17;

let movesets: MovesetData;
beforeAll(async () => {
  movesets = await loadMovesets();
});

describe('dealOnboarding', () => {
  it('is deterministic for a save seed', () => {
    const a = dealOnboarding(saveWithSeed(42), movesets);
    const b = dealOnboarding(saveWithSeed(42), movesets);
    expect(a).toEqual(b);
    const others = [1, 2, 3, 4, 5].map((seed) => dealOnboarding(saveWithSeed(seed), movesets));
    expect(new Set(others.map((d) => d.loanerSpeciesId)).size).toBeGreaterThan(1);
  });

  it('deals a common or uncommon loaner with moves, picked by hashSeed(seed, "loaner")', () => {
    for (const seed of [0, 1, 2, 42, 1234]) {
      const deal = dealOnboarding(saveWithSeed(seed), movesets);
      const loaner = getSpecies(deal.loanerSpeciesId);
      expect(loaner && ['common', 'uncommon'].includes(loaner.rarity)).toBe(true);
      expect(movesFor(movesets, loaner?.slug ?? '').length).toBeGreaterThan(0);

      const pool = [...speciesOfRarity('common'), ...speciesOfRarity('uncommon')].filter(
        (s) => movesFor(movesets, s.slug).length > 0,
      );
      const index = Math.floor(createRng(hashSeed(seed, 'loaner'))() * pool.length);
      expect(deal.loanerSpeciesId).toBe(pool[index]?.id);
    }
  });

  it('deals a common rival with moves and a BST no higher than the loaner’s', () => {
    for (const seed of [0, 1, 2, 42, 1234, REPICK_SEED]) {
      const deal = dealOnboarding(saveWithSeed(seed), movesets);
      const loaner = getSpecies(deal.loanerSpeciesId);
      const rival = getSpecies(deal.rivalSpeciesId);
      expect(rival?.rarity).toBe('common');
      expect(movesFor(movesets, rival?.slug ?? '').length).toBeGreaterThan(0);
      expect(rival?.bst).toBeLessThanOrEqual(loaner?.bst ?? 0);
    }
  });

  it('picks the rival with hashSeed(seed, "rival", k) over the candidates in speciesOfRarity order', () => {
    const save = saveWithSeed(42);
    const deal = dealOnboarding(save, movesets);
    const loaner = getSpecies(deal.loanerSpeciesId);
    if (!loaner) throw new Error('no loaner');
    const candidates = speciesOfRarity('common').filter(
      (s) => s.bst <= loaner.bst && movesFor(movesets, s.slug).length > 0,
    );
    expect(rivalCandidates(loaner, movesets).map((s) => s.id)).toEqual(candidates.map((s) => s.id));
    const k = deal.rivalPick;
    const index = Math.floor(createRng(hashSeed(42, 'rival', k))() * candidates.length);
    expect(deal.rivalSpeciesId).toBe(candidates[index]?.id);
  });

  it('makes the intro winnable: the loaner beats the rival on the returned seed', () => {
    for (const seed of [0, 1, 42, REPICK_SEED]) {
      const save = saveWithSeed(seed);
      const deal = dealOnboarding(save, movesets);
      const loaner = getSpecies(deal.loanerSpeciesId);
      const rival = getSpecies(deal.rivalSpeciesId);
      if (!loaner || !rival) throw new Error('missing species');
      const { red, blue } = buildIntroTeams(loaner, rival, movesets, save.trainer.name);
      expect(red.fighters[0]?.level).toBe(economy.onboarding.loanerLevel);
      expect(blue.fighters[0]?.level).toBe(economy.onboarding.rivalLevel);
      expect(red.fighters[0]?.badges).toEqual({ stars: 1, talentIcons: [] });
      expect(findIntroSeed(red, blue)).toBe(deal.introSeed);
      expect(simulateBattle(red, blue, deal.introSeed).result.winner).toBe('red');
    }
  });

  it('moves on to the next rival when the first one is unwinnable (IntroSeedError)', () => {
    const deal = dealOnboarding(saveWithSeed(REPICK_SEED), movesets);
    expect(deal.rivalPick).toBe(1);
    const loaner = getSpecies(deal.loanerSpeciesId);
    if (!loaner) throw new Error('no loaner');
    const candidates = rivalCandidates(loaner, movesets);
    const first = rivalAt(REPICK_SEED, 0, candidates);
    if (!first) throw new Error('no first rival');
    const { red, blue } = buildIntroTeams(loaner, first, movesets, 'Tester');
    expect(() => findIntroSeed(red, blue)).toThrow(IntroSeedError);
    expect(deal.rivalSpeciesId).toBe(rivalAt(REPICK_SEED, 1, candidates)?.id);
  });

  it('gives up with OnboardingDealError after RIVAL_PICK_LIMIT unwinnable rivals', () => {
    intro.fail = true;
    try {
      expect(() => dealOnboarding(saveWithSeed(42), movesets)).toThrow(OnboardingDealError);
      expect(RIVAL_PICK_LIMIT).toBeGreaterThan(0);
    } finally {
      intro.fail = false;
    }
  });

  it('only deals species that have moves', () => {
    const loaner = pickLoaner(42, movesets);
    // Strip the loaner's moveset: it leaves the pool and a different species is dealt.
    const sets = Object.fromEntries(
      Object.entries(movesets.sets).filter(([slug]) => slug !== loaner.slug),
    );
    const stripped: MovesetData = { ...movesets, sets };
    expect(loanerPool(stripped).some((s) => s.id === loaner.id)).toBe(false);
    expect(pickLoaner(42, stripped).id).not.toBe(loaner.id);
    expect(() => pickLoaner(42, { moves: movesets.moves, sets: {} })).toThrow(OnboardingDealError);
  });
});
