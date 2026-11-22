import { describe, expect, it } from 'vitest';
import { collectionOf, homeSave, ownedMon } from '../testing';
import {
  addFirstToTeam,
  commitDeal,
  firstOwned,
  homeStep,
  isFreshV1Import,
  markCapsuleOpened,
} from './onboarding';

describe('homeStep', () => {
  it('follows the saved step', () => {
    expect(homeStep(homeSave())).toBe('hero');
    expect(
      homeStep(homeSave({ onboarding: { step: 'dealt', loanerSpeciesId: 1, rivalSpeciesId: 4 } })),
    ).toBe('dealt');
    expect(
      homeStep(homeSave({ onboarding: { step: 'fought' }, capsules: { basic: 1, great: 0 } })),
    ).toBe('fought');
    expect(homeStep(homeSave({ onboarding: { step: 'done' } }))).toBe('done');
  });

  it('treats fought with the capsule already opened as capsule', () => {
    const save = homeSave({
      onboarding: { step: 'fought' },
      capsules: { basic: 0, great: 0 },
      collection: collectionOf(ownedMon(25)),
    });
    expect(homeStep(save)).toBe('capsule');
  });

  it('keeps fought while the capsule is unopened or nothing is owned', () => {
    expect(
      homeStep(
        homeSave({
          onboarding: { step: 'fought' },
          capsules: { basic: 1, great: 0 },
          collection: collectionOf(ownedMon(25)),
        }),
      ),
    ).toBe('fought');
    expect(homeStep(homeSave({ onboarding: { step: 'fought' } }))).toBe('fought');
  });

  it('falls back to fought for capsule with an empty collection, and to hero for a deal without cards', () => {
    expect(homeStep(homeSave({ onboarding: { step: 'capsule' } }))).toBe('fought');
    expect(homeStep(homeSave({ onboarding: { step: 'dealt', loanerSpeciesId: 1 } }))).toBe('hero');
  });
});

describe('firstOwned', () => {
  it('returns the entry with the lowest obtainedAt', () => {
    const save = homeSave({
      collection: collectionOf(
        ownedMon(7, { obtainedAt: 30 }),
        ownedMon(4, { obtainedAt: 10 }),
        ownedMon(1, { obtainedAt: 20 }),
      ),
    });
    expect(firstOwned(save)?.speciesId).toBe(4);
    expect(firstOwned(homeSave())).toBeNull();
  });
});

describe('step transitions', () => {
  it('hero → dealt with both species ids', () => {
    const next = commitDeal(homeSave(), { loanerSpeciesId: 25, rivalSpeciesId: 19 });
    expect(next.onboarding).toEqual({ step: 'dealt', loanerSpeciesId: 25, rivalSpeciesId: 19 });
  });

  it('never re-deals once dealt', () => {
    const dealt = homeSave({
      onboarding: { step: 'dealt', loanerSpeciesId: 25, rivalSpeciesId: 19 },
    });
    expect(commitDeal(dealt, { loanerSpeciesId: 1, rivalSpeciesId: 4 })).toBe(dealt);
  });

  it('fought → capsule only from fought', () => {
    const fought = homeSave({ onboarding: { step: 'fought' } });
    expect(markCapsuleOpened(fought).onboarding.step).toBe('capsule');
    const done = homeSave({ onboarding: { step: 'done' } });
    expect(markCapsuleOpened(done)).toBe(done);
  });

  it('Add to team puts the first Pokémon in the team (the loaner leaves) and ends onboarding', () => {
    const save = homeSave({
      onboarding: { step: 'capsule', loanerSpeciesId: 25, rivalSpeciesId: 19 },
      collection: collectionOf(ownedMon(133)),
    });
    const next = addFirstToTeam(save, 133);
    expect(next.team).toEqual([133]);
    expect(next.onboarding.step).toBe('done');
  });

  it('Add to team ignores species that are not owned or a finished onboarding', () => {
    const save = homeSave({
      onboarding: { step: 'capsule' },
      collection: collectionOf(ownedMon(1)),
    });
    expect(addFirstToTeam(save, 4)).toBe(save);
    const done = homeSave({ onboarding: { step: 'done' }, collection: collectionOf(ownedMon(1)) });
    expect(addFirstToTeam(done, 1)).toBe(done);
  });
});

describe('isFreshV1Import', () => {
  const v1 = (over: Parameters<typeof homeSave>[0] = {}) =>
    homeSave({
      meta: { migratedFromV1: true },
      onboarding: { step: 'done' },
      collection: collectionOf(ownedMon(1), ownedMon(4)),
      ...over,
    });

  it('is true for a migrated save without v2 progress', () => {
    expect(isFreshV1Import(v1())).toBe(true);
  });

  it('is false once a capsule was opened or a stage cleared, or for a v2 save', () => {
    expect(isFreshV1Import(v1({ capsulesOpened: 1 }))).toBe(false);
    expect(isFreshV1Import(v1({ ladder: { cleared: 1, replayWins: 0 } }))).toBe(false);
    expect(isFreshV1Import(homeSave({ onboarding: { step: 'done' } }))).toBe(false);
  });
});
