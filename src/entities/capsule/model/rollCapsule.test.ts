import { describe, expect, it } from 'vitest';
import { getSpecies } from '@/entities/pokemon';
import { NATURES, ownedPokemonSchema, saveSchema, type Save } from '@/entities/save';
import {
  CAPSULE_TIERS,
  economy,
  IV_MAX,
  RARITIES,
  type CapsuleTier,
  type Rarity,
} from '@/shared/config/economy';
import { rarityRank } from './rarity';
import { openMany, rarityFromDraw, rollCapsule } from './rollCapsule';
import { owned, testSave } from './testSave';
import { CapsuleError } from './types';

const NOW = 1_700_000_000_000;
const GREAT_LEVEL = economy.trainer.unlocks.greatCapsules;

/** A save that can open `tier`, past the first capsule and with no pity built up. */
function ready(tier: CapsuleTier, extra: Parameters<typeof testSave>[0] = {}): Save {
  return testSave({
    capsules: { basic: 0, great: 0, [tier]: 5 },
    capsulesOpened: 1,
    trainer: { level: GREAT_LEVEL },
    ...extra,
  });
}

describe('rollCapsule: determinism and bookkeeping', () => {
  it('gives the same result for the same save and tier', () => {
    const save = ready('basic', { meta: { ...testSave().meta, pullIndex: 7 } });
    const a = rollCapsule(save, 'basic', NOW);
    const b = rollCapsule(save, 'basic', NOW);
    expect(a).toEqual(b);
    expect(a.result.pullIndex).toBe(7);
  });

  it('advances meta.pullIndex by one per open, so a reload never re-rolls the same pull', () => {
    const save = ready('basic');
    const first = rollCapsule(save, 'basic', NOW);
    expect(first.save.meta.pullIndex).toBe(save.meta.pullIndex + 1);
    const second = rollCapsule(first.save, 'basic', NOW);
    expect(second.save.meta.pullIndex).toBe(save.meta.pullIndex + 2);
    expect(second.result.pullIndex).not.toBe(first.result.pullIndex);
  });

  it('spends one capsule, counts the open and leaves onboarding, team and trainer alone', () => {
    const save = ready('basic', { team: [25], onboarding: { ...testSave().onboarding } });
    const { save: next } = rollCapsule(save, 'basic', NOW);
    expect(next.capsules.basic).toBe(4);
    expect(next.capsules.great).toBe(0);
    expect(next.capsulesOpened).toBe(2);
    expect(next.onboarding).toBe(save.onboarding);
    expect(next.team).toBe(save.team);
    expect(next.trainer).toBe(save.trainer);
    expect(() => saveSchema.parse(next)).not.toThrow();
  });

  it('does not mutate the input save', () => {
    const save = ready('basic');
    const snapshot = structuredClone(save);
    rollCapsule(save, 'basic', NOW);
    expect(save).toEqual(snapshot);
  });

  it('throws when the tier has no capsules', () => {
    const save = ready('basic', { capsules: { basic: 0, great: 3 } });
    expect(() => rollCapsule(save, 'basic', NOW)).toThrow(CapsuleError);
    try {
      rollCapsule(save, 'basic', NOW);
    } catch (e) {
      expect((e as CapsuleError).code).toBe('noCapsules');
    }
  });

  it('refuses a locked tier (Great below the unlock level)', () => {
    const save = ready('great', { trainer: { level: GREAT_LEVEL - 1 } });
    expect(() => rollCapsule(save, 'great', NOW)).toThrow(/locked/);
  });

  it('emits one capsuleOpened event and does not apply it', () => {
    const save = ready('basic');
    const { result, events } = rollCapsule(save, 'basic', NOW);
    expect(events).toEqual([
      {
        kind: 'capsuleOpened',
        tier: 'basic',
        rarity: result.rarity,
        speciesId: result.speciesId,
        duplicate: false,
      },
    ]);
  });
});

describe('rollCapsule: rarity', () => {
  it('maps draws onto the odds table', () => {
    const odds = economy.capsules.odds.basic;
    expect(rarityFromDraw(0, 'basic')).toBe('common');
    expect(rarityFromDraw((odds.common - 0.001) / 100, 'basic')).toBe('common');
    expect(rarityFromDraw(odds.common / 100, 'basic')).toBe('uncommon');
    expect(rarityFromDraw(0.999999, 'basic')).toBe('legendary');
  });

  it.each(CAPSULE_TIERS)('matches economy.capsules.odds.%s over many seeded rolls', (tier) => {
    const N = 40_000;
    const counts = Object.fromEntries(RARITIES.map((r) => [r, 0])) as Record<Rarity, number>;
    // No pity built up and past the first capsule: every pull is a plain draw from the odds table.
    const save = ready(tier);
    for (let i = 0; i < N; i++) {
      const s: Save = { ...save, meta: { ...save.meta, pullIndex: i } };
      counts[rollCapsule(s, tier, NOW).result.rarity] += 1;
    }
    for (const rarity of RARITIES) {
      const p = economy.capsules.odds[tier][rarity] / 100;
      const expected = N * p;
      const sigma = Math.sqrt(N * p * (1 - p));
      // 5σ: a deterministic (seeded) check that still fails on any real skew.
      expect(Math.abs(counts[rarity] - expected), `${tier}/${rarity}`).toBeLessThanOrEqual(
        5 * sigma + 1,
      );
    }
  });

  it('picks the species uniformly from the rolled rarity', () => {
    const save = ready('basic');
    const seen = new Set<number>();
    for (let i = 0; i < 2000; i++) {
      const { result } = rollCapsule(
        { ...save, meta: { ...save.meta, pullIndex: i } },
        'basic',
        NOW,
      );
      expect(getSpecies(result.speciesId)?.rarity).toBe(result.rarity);
      seen.add(result.speciesId);
    }
    // 2000 pulls over ~900 species: a uniform pick touches hundreds of them.
    expect(seen.size).toBeGreaterThan(400);
  });

  it('guarantees the first capsule ever is at least firstCapsuleMinRarity', () => {
    const floor = rarityRank(economy.capsules.firstCapsuleMinRarity);
    let raised = 0;
    for (let seed = 1; seed <= 1500; seed++) {
      const save = testSave({
        meta: { ...testSave().meta, seed },
        capsules: { basic: 1, great: 0 },
      });
      const { result } = rollCapsule(save, 'basic', NOW);
      expect(rarityRank(result.rarity)).toBeGreaterThanOrEqual(floor);
      expect(result.firstCapsule).toBe(true);
      if (result.raisedBy === 'first') raised += 1;
    }
    expect(raised).toBeGreaterThan(0);
  });

  it('does not apply the first-capsule floor after the first open', () => {
    const save = ready('basic');
    const rarities = new Set<Rarity>();
    for (let i = 0; i < 300; i++) {
      rarities.add(
        rollCapsule({ ...save, meta: { ...save.meta, pullIndex: i } }, 'basic', NOW).result.rarity,
      );
    }
    expect(rarities.has('common')).toBe(true);
  });
});

describe('rollCapsule: pity', () => {
  it.each(CAPSULE_TIERS)(
    'guarantees the pity rarity of %s on the N-th open since it last dropped',
    (tier) => {
      const { rarity, opens } = economy.capsules.pity[tier];
      for (let i = 0; i < 500; i++) {
        const base = ready(tier, { pity: { basic: 0, great: 0, [tier]: opens - 1 } });
        const save = { ...base, meta: { ...base.meta, pullIndex: i } };
        const { result, save: next } = rollCapsule(save, tier, NOW);
        expect(rarityRank(result.rarity)).toBeGreaterThanOrEqual(rarityRank(rarity));
        expect(next.pity[tier]).toBe(0);
        expect(result.pity).toMatchObject({ reset: true, count: 0, left: opens, opens, rarity });
      }
    },
  );

  it('ticks the counter up on a roll below the pity rarity and resets it on one at or above', () => {
    const { rarity, opens } = economy.capsules.pity.basic;
    let ticked = 0;
    let reset = 0;
    for (let i = 0; i < 500; i++) {
      const base = ready('basic', { pity: { basic: 3, great: 0 } });
      const { result, save: next } = rollCapsule(
        { ...base, meta: { ...base.meta, pullIndex: i } },
        'basic',
        NOW,
      );
      if (rarityRank(result.rarity) >= rarityRank(rarity)) {
        reset += 1;
        expect(next.pity.basic).toBe(0);
        expect(result.pity.reset).toBe(true);
      } else {
        ticked += 1;
        expect(next.pity.basic).toBe(4);
        expect(result.pity).toMatchObject({ reset: false, count: 4, left: opens - 4 });
      }
      expect(next.pity.great).toBe(0);
    }
    expect(ticked).toBeGreaterThan(0);
    expect(reset).toBeGreaterThan(0);
  });

  it('does not force the pity rarity one open early', () => {
    const { rarity, opens } = economy.capsules.pity.basic;
    let below = 0;
    for (let i = 0; i < 300; i++) {
      const base = ready('basic', { pity: { basic: opens - 2, great: 0 } });
      const { result } = rollCapsule(
        { ...base, meta: { ...base.meta, pullIndex: i } },
        'basic',
        NOW,
      );
      if (rarityRank(result.rarity) < rarityRank(rarity)) below += 1;
    }
    expect(below).toBeGreaterThan(0);
  });

  it('hits the pity on exactly the N-th open of a dry streak', () => {
    const { rarity, opens } = economy.capsules.pity.basic;
    // Walk real saves forward; whenever a streak reaches N opens, that open must drop the rarity.
    let save = ready('basic', { capsules: { basic: 400, great: 0 } });
    let streak = 0;
    for (let i = 0; i < 400; i++) {
      const { result, save: next } = rollCapsule(save, 'basic', NOW);
      streak += 1;
      if (rarityRank(result.rarity) >= rarityRank(rarity)) streak = 0;
      expect(streak).toBeLessThan(opens);
      expect(next.pity.basic).toBe(streak);
      save = next;
    }
  });
});

describe('rollCapsule: new species and duplicates', () => {
  /** The species the given save is about to roll (the collection never changes rarity or species draws). */
  const nextSpecies = (save: Save) => rollCapsule(save, 'basic', NOW).result;

  it('adds a new species at level 1, ★1, with IVs and a nature from the pull', () => {
    const save = ready('basic');
    const { result, save: next } = rollCapsule(save, 'basic', NOW);
    expect(result.outcome).toBe('new');
    const pokemon = next.collection[String(result.speciesId)];
    expect(pokemon).toBeDefined();
    expect(() => ownedPokemonSchema.parse(pokemon)).not.toThrow();
    expect(pokemon).toMatchObject({
      speciesId: result.speciesId,
      level: 1,
      xp: 0,
      stars: 1,
      dupes: 0,
      talents: [],
      obtainedAt: NOW,
    });
    for (const iv of Object.values(pokemon?.ivs ?? {})) {
      expect(Number.isInteger(iv)).toBe(true);
      expect(iv).toBeGreaterThanOrEqual(0);
      expect(iv).toBeLessThanOrEqual(IV_MAX);
    }
    expect(NATURES).toContain(pokemon?.nature);
    expect(result).toMatchObject({ stars: 1, dupes: 0, dustGained: 0 });
  });

  it('turns a duplicate at ★1 into ★2 (dupesForNextStar[1])', () => {
    const save = ready('basic');
    const { speciesId } = nextSpecies(save);
    const withIt = { ...save, collection: { [String(speciesId)]: owned(speciesId, { level: 7 }) } };
    const { result, save: next, events } = rollCapsule(withIt, 'basic', NOW);
    expect(economy.pokemon.dupesForNextStar[1]).toBe(1);
    expect(result).toMatchObject({ speciesId, outcome: 'starUp', stars: 2, dupes: 0 });
    expect(next.collection[String(speciesId)]).toMatchObject({ stars: 2, dupes: 0, level: 7 });
    expect(events[0]).toMatchObject({ kind: 'capsuleOpened', duplicate: true });
  });

  it('counts duplicates towards the next star until dupesForNextStar is reached', () => {
    const save = ready('basic');
    const { speciesId } = nextSpecies(save);
    const need = economy.pokemon.dupesForNextStar[2] ?? 0;
    expect(need).toBeGreaterThan(1);

    const partial = {
      ...save,
      collection: { [String(speciesId)]: owned(speciesId, { stars: 2 }) },
    };
    const a = rollCapsule(partial, 'basic', NOW);
    expect(a.result).toMatchObject({ outcome: 'dupe', stars: 2, dupes: 1, dupesForNextStar: need });
    expect(a.save.dust).toBe(save.dust);

    const almost = {
      ...save,
      collection: { [String(speciesId)]: owned(speciesId, { stars: 2, dupes: need - 1 }) },
    };
    const b = rollCapsule(almost, 'basic', NOW);
    expect(b.result).toMatchObject({ outcome: 'starUp', stars: 3, dupes: 0 });
  });

  it('gives dust from economy.dust.fromDuplicate at max stars', () => {
    const save = ready('basic', { dust: 7 });
    const { speciesId, rarity } = nextSpecies(save);
    const maxed = owned(speciesId, { stars: economy.pokemon.maxStars, dupes: 0 });
    const { result, save: next } = rollCapsule(
      { ...save, collection: { [String(speciesId)]: maxed } },
      'basic',
      NOW,
    );
    const gain = economy.dust.fromDuplicate[rarity];
    expect(result).toMatchObject({
      outcome: 'dust',
      dustGained: gain,
      stars: economy.pokemon.maxStars,
      dupesForNextStar: 0,
    });
    expect(next.dust).toBe(7 + gain);
    expect(next.collection[String(speciesId)]).toEqual(maxed);
  });

  it('makes every duplicate yield something (a star step or dust)', () => {
    let save = ready('basic', { capsules: { basic: 3000, great: 0 } });
    for (let i = 0; i < 3000; i++) {
      const { result, save: next } = rollCapsule(save, 'basic', NOW);
      if (result.outcome !== 'new') {
        const before = save.collection[String(result.speciesId)];
        const after = next.collection[String(result.speciesId)];
        const progressed =
          (after?.stars ?? 0) > (before?.stars ?? 0) || (after?.dupes ?? 0) > (before?.dupes ?? 0);
        expect(progressed || result.dustGained > 0).toBe(true);
      }
      save = next;
    }
  });
});

describe('openMany', () => {
  it('folds rollCapsule count times, in roll order', () => {
    const save = ready('basic', { capsules: { basic: 4, great: 0 } });
    const many = openMany(save, 'basic', 3, NOW);

    let current = save;
    const expected = [];
    for (let i = 0; i < 3; i++) {
      const r = rollCapsule(current, 'basic', NOW);
      expected.push(r.result);
      current = r.save;
    }
    expect(many.results).toEqual(expected);
    expect(many.save).toEqual(current);
    expect(many.events).toHaveLength(3);
    expect(many.save.capsules.basic).toBe(1);
    expect(many.save.meta.pullIndex).toBe(save.meta.pullIndex + 3);
  });

  it('refuses to open more capsules than there are, or fewer than one', () => {
    const save = ready('basic', { capsules: { basic: 2, great: 0 } });
    expect(() => openMany(save, 'basic', 3, NOW)).toThrow(CapsuleError);
    expect(() => openMany(save, 'basic', 0, NOW)).toThrow(CapsuleError);
  });
});
