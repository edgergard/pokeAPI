import { describe, expect, it } from 'vitest';
import { economy } from '@/shared/config/economy';
import {
  learnedTalentBranches,
  pokemonTalentsOfBranch,
  talentModifiers,
  trainerBonuses,
} from './talentCatalog';
import {
  learnPokemonTalent,
  learnTrainerTalent,
  pokemonTalentNodeState,
  resetPokemonTalents,
  resetTrainerTalents,
  trainerTalentNodeState,
} from './talentRules';
import { POKEMON_TALENTS, TRAINER_TALENTS } from './talents';
import { talentPointsAvailable } from './pokemonLevel';
import { makeOwned, makeSave } from './testSaves';

describe('talent content', () => {
  it('has 3 branches × 4 tiers of Pokémon talents with stable ids', () => {
    expect(POKEMON_TALENTS).toHaveLength(12);
    expect(new Set(POKEMON_TALENTS.map((t) => t.id)).size).toBe(12);
    for (const branch of ['offense', 'defense', 'tempo'] as const) {
      const nodes = pokemonTalentsOfBranch(branch);
      expect(nodes.map((t) => t.tier)).toEqual([1, 2, 3, 4]);
      expect(nodes.map((t) => t.id)).toEqual([1, 2, 3, 4].map((n) => `${branch}-${n}`));
    }
    for (const talent of POKEMON_TALENTS) {
      expect(talent.effects.length).toBeGreaterThan(0);
      expect(talent.description.length).toBeGreaterThan(0);
      for (const effect of talent.effects) {
        expect(['statPercent', 'critChance', 'firstStrike']).toContain(effect.kind);
      }
    }
  });

  it('has ~15 trainer talents that change rules, gated over trainer levels 2–30', () => {
    expect(TRAINER_TALENTS.length).toBeGreaterThanOrEqual(10);
    expect(TRAINER_TALENTS.length).toBeLessThanOrEqual(20);
    const byId = new Map(TRAINER_TALENTS.map((t) => [t.id, t]));
    expect(byId.size).toBe(TRAINER_TALENTS.length);
    const levels = TRAINER_TALENTS.map((t) => t.requiresLevel);
    expect(Math.min(...levels)).toBe(economy.trainer.talentPointsFromLevel);
    expect(Math.max(...levels)).toBe(economy.trainer.maxLevel);
    for (const talent of TRAINER_TALENTS) {
      for (const effect of talent.effects) {
        expect([
          'xpPercent',
          'dustPercent',
          'benchXpPercent',
          'capsuleChance',
          'critChance',
        ]).toContain(effect.kind);
      }
      for (const id of talent.requires) {
        const required = byId.get(id);
        expect(required, `${talent.id} requires unknown ${id}`).toBeDefined();
        // prerequisites are learnable no later than the node itself (no dead nodes, no cycles)
        expect(required?.requiresLevel).toBeLessThan(talent.requiresLevel);
      }
    }
  });
});

describe('learnPokemonTalent', () => {
  it('needs a free point', () => {
    const result = learnPokemonTalent(makeOwned(25, { level: 4 }), 'offense-1');
    expect(result).toEqual({ ok: false, reason: 'noPoints', nextPointAt: 5 });
  });

  it('learns tier 1 with a point and spends it', () => {
    const owned = makeOwned(25, { level: 5 });
    const result = learnPokemonTalent(owned, 'offense-1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.owned.talents).toEqual(['offense-1']);
    expect(talentPointsAvailable(result.owned)).toBe(0);
    expect(owned.talents).toEqual([]); // input untouched
    expect(learnPokemonTalent(result.owned, 'defense-1')).toEqual({
      ok: false,
      reason: 'noPoints',
      nextPointAt: 10,
    });
  });

  it('needs the previous tier of the same branch', () => {
    const owned = makeOwned(25, { level: 20, talents: ['defense-1'] });
    expect(learnPokemonTalent(owned, 'offense-2')).toEqual({
      ok: false,
      reason: 'requiresTier',
      requires: 'offense-1',
    });
    expect(learnPokemonTalent(owned, 'defense-2').ok).toBe(true);
  });

  it('rejects unknown and already learned talents', () => {
    const owned = makeOwned(25, { level: 20, talents: ['tempo-1'] });
    expect(learnPokemonTalent(owned, 'tempo-9')).toEqual({ ok: false, reason: 'unknownTalent' });
    expect(learnPokemonTalent(owned, 'tempo-1')).toEqual({ ok: false, reason: 'alreadyLearned' });
  });

  it('resets for free and gives every point back', () => {
    const owned = makeOwned(25, { level: 10, talents: ['offense-1', 'offense-2'] });
    expect(talentPointsAvailable(owned)).toBe(0);
    const reset = resetPokemonTalents(owned);
    expect(reset.talents).toEqual([]);
    expect(talentPointsAvailable(reset)).toBe(2);
    expect(owned.talents).toHaveLength(2);
    expect(resetPokemonTalents(reset)).toBe(reset);
  });

  it('reports node states for the tree', () => {
    const owned = makeOwned(25, { level: 5, talents: [] });
    expect(pokemonTalentNodeState(owned, 'offense-1')).toEqual({ state: 'available' });
    expect(pokemonTalentNodeState(owned, 'offense-2')).toEqual({
      state: 'locked',
      reason: 'requiresTier',
      requires: 'offense-1',
    });
    const learned = { ...owned, talents: ['offense-1'] };
    expect(pokemonTalentNodeState(learned, 'offense-1')).toEqual({ state: 'learned' });
    expect(pokemonTalentNodeState(learned, 'offense-2')).toEqual({
      state: 'locked',
      reason: 'noPoints',
      nextPointAt: 10,
    });
  });
});

describe('learnTrainerTalent', () => {
  it('requires the trainer level', () => {
    const save = makeSave({ trainer: { level: 5, talentPoints: 3, talents: ['dust-collector'] } });
    expect(learnTrainerTalent(save, 'lucky-find')).toEqual({
      ok: false,
      reason: 'requiresLevel',
      level: 6,
    });
  });

  it('requires every prerequisite', () => {
    const save = makeSave({ trainer: { level: 12, talentPoints: 3, talents: [] } });
    expect(learnTrainerTalent(save, 'eagle-eye')).toEqual({
      ok: false,
      reason: 'requiresTalents',
      missing: ['quick-draw'],
    });
    const capstone = makeSave({
      trainer: { level: 30, talentPoints: 3, talents: ['master-trainer'] },
    });
    expect(learnTrainerTalent(capstone, 'champions-road')).toMatchObject({
      ok: false,
      reason: 'requiresTalents',
      missing: ['golden-touch', 'killer-instinct'],
    });
  });

  it('requires a talent point', () => {
    const save = makeSave({ trainer: { level: 8, talentPoints: 0, talents: [] } });
    expect(learnTrainerTalent(save, 'quick-draw')).toEqual({
      ok: false,
      reason: 'noPoints',
      nextPointAt: 9,
    });
  });

  it('spends a point and records the talent', () => {
    const save = makeSave({ trainer: { level: 5, talentPoints: 2, talents: [] } });
    const result = learnTrainerTalent(save, 'quick-draw');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.save.trainer).toMatchObject({ talentPoints: 1, talents: ['quick-draw'] });
    expect(save.trainer.talents).toEqual([]);
    expect(learnTrainerTalent(result.save, 'quick-draw')).toEqual({
      ok: false,
      reason: 'alreadyLearned',
    });
    expect(learnTrainerTalent(result.save, 'nope')).toEqual({ ok: false, reason: 'unknownTalent' });
  });

  it('resets for free and refunds every point', () => {
    const save = makeSave({
      trainer: { level: 10, talentPoints: 1, talents: ['field-notes', 'dust-collector'] },
    });
    const reset = resetTrainerTalents(save);
    expect(reset.trainer).toMatchObject({ talentPoints: 3, talents: [] });
    expect(resetTrainerTalents(reset)).toBe(reset);
  });

  it('reports node states for the tree', () => {
    const save = makeSave({ trainer: { level: 6, talentPoints: 1, talents: ['quick-draw'] } });
    expect(trainerTalentNodeState(save, 'quick-draw')).toEqual({ state: 'learned' });
    expect(trainerTalentNodeState(save, 'field-notes')).toEqual({ state: 'available' });
    expect(trainerTalentNodeState(save, 'eagle-eye')).toEqual({
      state: 'locked',
      reason: 'requiresLevel',
      level: 12,
    });
  });
});

describe('modifiers and bonuses', () => {
  it('sums Pokémon and team-wide trainer crit chance, and flags first strike', () => {
    const owned = makeOwned(25, { talents: ['offense-3', 'tempo-3', 'tempo-4'] });
    expect(talentModifiers(owned)).toEqual({ critChance: 8, firstStrike: true });
    expect(talentModifiers(owned, ['quick-draw', 'eagle-eye'])).toEqual({
      critChance: 15,
      firstStrike: true,
    });
    expect(talentModifiers(makeOwned(25))).toEqual({ critChance: 0, firstStrike: false });
  });

  it('sums trainer rule bonuses', () => {
    expect(trainerBonuses(['field-notes', 'sparring-partners', 'dust-collector'])).toEqual({
      xpPercent: 10,
      dustPercent: 10,
      benchXpPercent: 10,
      capsuleChance: 0,
      critChance: 0,
    });
    expect(trainerBonuses(['unknown'])).toEqual(trainerBonuses([]));
  });

  it('lists learned branches in branch order', () => {
    expect(learnedTalentBranches(['tempo-1', 'offense-1', 'offense-2'])).toEqual([
      'offense',
      'tempo',
    ]);
    expect(learnedTalentBranches([])).toEqual([]);
  });
});
