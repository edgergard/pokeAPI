import { describe, expect, it } from 'vitest';
import { getSpecies } from '@/entities/pokemon';
import type { Save } from '@/entities/save';
import { economy } from '@/shared/config/economy';
import { createRng, hashSeed } from '@/shared/lib/rng';
import { applyBattleResult, type BattleInput } from './battleResult';
import { addPokemonXp } from './pokemonLevel';
import { T0, makeOwned, makeSave } from './testSaves';

const PIKACHU = 25; // medium growth
const BULBASAUR = 1; // medium-slow growth
const EEVEE = 133; // medium growth

function baseSave(overrides: Parameters<typeof makeSave>[0] = {}): Save {
  return makeSave({
    owned: [makeOwned(PIKACHU), makeOwned(EEVEE), makeOwned(BULBASAUR)],
    team: [PIKACHU],
    ...overrides,
  });
}

function battle(save: Save, input: Partial<BattleInput> & Pick<BattleInput, 'stage'>) {
  return applyBattleResult(save, {
    won: true,
    damageDealt: 120,
    teamIds: [PIKACHU],
    now: T0 + 1000,
    ...input,
  });
}

describe('applyBattleResult — first clear', () => {
  const save = baseSave();
  const { save: next, summary } = battle(save, { stage: 1 });

  it('grants the first-clear reward and advances the ladder', () => {
    expect(next.capsules.basic).toBe(1);
    expect(next.dust).toBe(20);
    expect(next.ladder).toEqual({ cleared: 1, replayWins: 0 });
    expect(summary).toMatchObject({
      outcome: 'won',
      stage: 1,
      firstClear: true,
      capsules: { basic: 1, great: 0 },
      dust: 20,
      bonusCapsule: false,
      replay: { wins: 0, every: economy.battle.replayCapsuleEveryWins, capsuleEarned: false },
    });
  });

  it('gives trainer and team XP by stage, and the bench its share', () => {
    expect(summary.trainer).toMatchObject({ xp: 72, fromLevel: 1, toLevel: 1, toXp: 72 }); // 60 + 12
    expect(next.trainer.xp).toBe(72);
    expect(summary.teamXp).toBe(50); // 40 + 10
    expect(summary.benchXp).toBe(12); // floor(50 × 0.25)

    // Pikachu (medium): 50 XP from Lv 1 → Lv 9 with 13 towards Lv 10
    expect(next.collection[String(PIKACHU)]).toMatchObject({ level: 9, xp: 13 });
    // Eevee (medium, bench): 12 XP = 1 + 1 + 2 + 3 + 5 → Lv 6 exactly
    expect(next.collection[String(EEVEE)]).toMatchObject({ level: 6, xp: 0 });
    const bulbasaur = getSpecies(BULBASAUR);
    if (!bulbasaur) throw new Error('missing species');
    expect(next.collection[String(BULBASAUR)]).toEqual(
      addPokemonXp(makeOwned(BULBASAUR), bulbasaur, 12).owned,
    );

    expect(summary.pokemon.map((p) => [p.speciesId, p.bench])).toEqual([
      [PIKACHU, false],
      [BULBASAUR, true],
      [EEVEE, true],
    ]);
    expect(summary.pokemon[0]).toMatchObject({
      xp: 50,
      fromLevel: 1,
      toLevel: 9,
      fromXp: 0,
      toXp: 13,
      levelsGained: 8,
      atCap: false,
      levelCap: 10,
      talentPointsGained: 1,
    });
  });

  it('emits battle, stage, damage and level events', () => {
    const kinds = summary.events.map((e) => e.kind);
    expect(summary.events.slice(0, 3)).toEqual([
      { kind: 'battleWon', stage: 1 },
      { kind: 'stageCleared', stage: 1 },
      { kind: 'damageDealt', amount: 120 },
    ]);
    const pikachuLevels = summary.events.filter(
      (e) => e.kind === 'pokemonLeveled' && e.speciesId === PIKACHU,
    );
    expect(pikachuLevels.map((e) => (e.kind === 'pokemonLeveled' ? e.level : 0))).toEqual([
      2, 3, 4, 5, 6, 7, 8, 9,
    ]);
    const leveled = summary.pokemon.reduce((n, p) => n + p.levelsGained, 0);
    expect(kinds.filter((k) => k === 'pokemonLeveled')).toHaveLength(leveled);
    expect(kinds).not.toContain('trainerLeveled');
  });

  it('bumps the battle counters and the seen clock', () => {
    expect(next.meta.battleIndex).toBe(1);
    expect(next.meta.battlesSinceExport).toBe(1);
    expect(next.meta.maxSeenTime).toBe(T0 + 1000);
  });

  it('does not mutate the input save', () => {
    expect(save).toEqual(baseSave());
  });
});

describe('applyBattleResult — replay', () => {
  it('gives a basic capsule on every Nth replay win and resets the streak', () => {
    let save = baseSave({ ladder: { cleared: 3, replayWins: 0 } });
    const every = economy.battle.replayCapsuleEveryWins;
    for (let win = 1; win < every; win++) {
      const result = battle(save, { stage: 2 });
      expect(result.summary.firstClear).toBe(false);
      expect(result.summary.replay).toEqual({ wins: win, every, capsuleEarned: false });
      expect(result.summary.capsules.basic).toBe(0);
      expect(result.summary.dust).toBe(0);
      save = result.save;
    }
    const last = battle(save, { stage: 2 });
    expect(last.summary.replay).toEqual({ wins: 0, every, capsuleEarned: true });
    expect(last.summary.capsules.basic).toBe(1);
    expect(last.save.capsules.basic).toBe(1);
    expect(last.save.ladder).toEqual({ cleared: 3, replayWins: 0 });
    expect(last.summary.events.map((e) => e.kind)).not.toContain('stageCleared');
  });
});

describe('applyBattleResult — loss', () => {
  it('gives lossShare XP and no stage rewards', () => {
    const save = baseSave({ ladder: { cleared: 0, replayWins: 0 } });
    const { save: next, summary } = battle(save, { stage: 1, won: false });
    expect(summary.outcome).toBe('lost');
    expect(summary.trainer.xp).toBe(18); // floor(72 × 0.25)
    expect(summary.teamXp).toBe(12); // floor(50 × 0.25)
    expect(summary.benchXp).toBe(3); // floor(12 × 0.25)
    expect(summary.firstClear).toBe(false);
    expect(summary.capsules).toEqual({ basic: 0, great: 0 });
    expect(next.capsules).toEqual(save.capsules);
    expect(next.dust).toBe(0);
    expect(next.ladder).toEqual(save.ladder);
    expect(summary.events[0]).toEqual({ kind: 'battleLost', stage: 1 });
    expect(next.meta.battleIndex).toBe(1);
  });

  it('leaves the replay streak alone', () => {
    const save = baseSave({ ladder: { cleared: 4, replayWins: 2 } });
    const { save: next } = battle(save, { stage: 3, won: false });
    expect(next.ladder).toEqual({ cleared: 4, replayWins: 2 });
  });
});

describe('applyBattleResult — intro', () => {
  it('grants the intro reward only', () => {
    const save = makeSave({ owned: [] });
    const fresh = { ...save, onboarding: { ...save.onboarding, step: 'fought' as const } };
    const { save: next, summary } = applyBattleResult(fresh, {
      stage: 'intro',
      won: true,
      damageDealt: 80,
      teamIds: [PIKACHU],
      now: T0,
    });
    expect(next.capsules).toEqual({ basic: 1, great: 0 });
    expect(next.dust).toBe(0);
    expect(next.trainer).toEqual(fresh.trainer);
    expect(next.collection).toBe(fresh.collection);
    expect(next.ladder).toEqual(fresh.ladder);
    expect(next.onboarding).toBe(fresh.onboarding);
    expect(next.meta.battleIndex).toBe(1);
    expect(next.meta.battlesSinceExport).toBe(1);
    expect(summary).toMatchObject({
      outcome: 'won',
      stage: 'intro',
      firstClear: false,
      teamXp: 0,
      benchXp: 0,
      pokemon: [],
      capsules: { basic: 1, great: 0 },
      replay: null,
    });
    expect(summary.events).toEqual([
      { kind: 'battleWon', stage: 'intro' },
      { kind: 'damageDealt', amount: 80 },
    ]);
  });
});

describe('applyBattleResult — trainer talents', () => {
  it('raises the bench share with benchXpPercent', () => {
    const plain = battle(baseSave(), { stage: 1 }).summary;
    const talented = battle(
      baseSave({ trainer: { level: 4, talents: ['field-notes', 'sparring-partners'] } }),
      { stage: 1 },
    ).summary;
    expect(plain.benchXp).toBe(12);
    expect(talented.teamXp).toBe(55); // floor(50 × 1.10)
    expect(talented.benchXp).toBe(19); // floor(55 × (0.25 + 0.10))
  });

  it('adds the dust bonus to the first-clear dust', () => {
    const { summary, save } = battle(
      baseSave({ trainer: { level: 3, talents: ['dust-collector'] } }),
      { stage: 1 },
    );
    expect(summary.dust).toBe(22);
    expect(save.dust).toBe(22);
  });

  it('rolls the bonus capsule from the seeded battle index only on wins', () => {
    const talents = ['dust-collector', 'lucky-find']; // 5%
    const seed = 42;
    const roll = (battleIndex: number) =>
      createRng(hashSeed(seed, 'battle-bonus', battleIndex))() * 100;
    const indices = Array.from({ length: 400 }, (_, i) => i);
    const hit = indices.find((i) => roll(i) < 5);
    const miss = indices.find((i) => roll(i) >= 5);
    if (hit === undefined || miss === undefined) throw new Error('no hit/miss in range');

    const at = (battleIndex: number, won = true) => {
      const save = baseSave({ seed, trainer: { level: 6, talents }, ladder: { cleared: 5 } });
      return battle({ ...save, meta: { ...save.meta, battleIndex } }, { stage: 1, won });
    };
    expect(at(hit).summary).toMatchObject({ bonusCapsule: true, capsules: { basic: 1 } });
    expect(at(hit).save.capsules.basic).toBe(1);
    expect(at(miss).summary).toMatchObject({ bonusCapsule: false, capsules: { basic: 0 } });
    expect(at(hit, false).summary.bonusCapsule).toBe(false);
    // deterministic
    expect(at(hit).save).toEqual(at(hit).save);
  });
});

describe('applyBattleResult — edges', () => {
  it('gives nothing to team ids outside the collection', () => {
    const { summary } = battle(baseSave(), { stage: 1, teamIds: [999, PIKACHU, PIKACHU] });
    expect(summary.pokemon.filter((p) => !p.bench).map((p) => p.speciesId)).toEqual([PIKACHU]);
    expect(summary.pokemon.map((p) => p.speciesId)).not.toContain(999);
  });

  it('flags Pokémon at their level cap and drops their XP', () => {
    const save = baseSave({ owned: [makeOwned(PIKACHU, { level: 10, stars: 1 })] });
    const { save: next, summary } = battle(save, { stage: 1 });
    expect(next.collection[String(PIKACHU)]).toEqual(save.collection[String(PIKACHU)]);
    expect(summary.pokemon[0]).toMatchObject({ atCap: true, levelsGained: 0, toLevel: 10 });
    expect(summary.events.map((e) => e.kind)).not.toContain('pokemonLeveled');
  });

  it('levels the trainer and lists the unlocks', () => {
    const save = baseSave({ trainer: { level: 1, xp: 190 } });
    const { save: next, summary } = battle(save, { stage: 1 });
    expect(next.trainer).toMatchObject({ level: 2, xp: 62, talentPoints: 1 });
    expect(summary.trainer).toMatchObject({
      fromLevel: 1,
      toLevel: 2,
      fromXp: 190,
      toXp: 62,
      levelsGained: 1,
      talentPointsGained: 1,
      atMax: false,
    });
    expect(summary.trainer.unlocks).toContainEqual({ kind: 'dailyQuests' });
    expect(summary.events).toContainEqual({ kind: 'trainerLeveled', level: 2 });
  });

  it('omits the damage event when no damage was dealt', () => {
    const { summary } = battle(baseSave(), { stage: 1, damageDealt: 0 });
    expect(summary.events.map((e) => e.kind)).not.toContain('damageDealt');
  });

  it('throws on a locked or out-of-range stage', () => {
    const save = baseSave({ ladder: { cleared: 2 } });
    expect(() => battle(save, { stage: 4 })).toThrow(RangeError);
    expect(() => battle(save, { stage: 0 })).toThrow(RangeError);
    expect(() => battle(save, { stage: 1.5 })).toThrow(RangeError);
    const done = baseSave({ ladder: { cleared: economy.battle.ladderStages } });
    expect(() => battle(done, { stage: economy.battle.ladderStages + 1 })).toThrow(RangeError);
    expect(() => battle(save, { stage: 3 })).not.toThrow();
  });
});
