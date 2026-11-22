import { beforeEach, describe, expect, it } from 'vitest';
import type { BattleResult } from '@/entities/battle';
import { makeOwned, makeSave, T0 } from '@/entities/ladder/testing/testSave';
import { applyBattleResult } from '@/entities/progression';
import { questDay, questEventReducer, questRows } from '@/entities/quest';
import { getSave, initSave, registerGameEventReducer, type Save } from '@/entities/save';
import { __resetSaveStoreForTests } from '@/entities/save/model/store';
import { economy } from '@/shared/config/economy';
import {
  commitIntroWin,
  commitStageBattle,
  finishOnboarding,
  markCapsuleOpened,
  questTicks,
  storeIntroRival,
} from './commit';

// As SaveProvider does at app start: game events advance daily quests.
registerGameEventReducer(questEventReducer);

const PIKACHU = 25;
const BULBASAUR = 1;

const result = (winner: 'red' | 'blue', redDamageDealt = 120): BattleResult => ({
  winner,
  reason: 'knockout',
  turns: 4,
  redDamageDealt,
  blueDamageDealt: 50,
  fighters: [],
});

async function load(save: Save) {
  await initSave(
    { durable: true, load: async () => ({ kind: 'loaded', save }), write: async () => true },
    () => save,
  );
}

/** A save past onboarding with three daily quests a battle can move. */
function questSave(): Save {
  const save = makeSave({
    owned: [makeOwned(PIKACHU, { level: 5 }), makeOwned(BULBASAUR, { level: 3 })],
    team: [PIKACHU],
    trainer: { level: economy.trainer.unlocks.dailyQuests },
  });
  const day = questDay(T0);
  const quest = (id: string, target: number) => ({ id, progress: 0, target, day, claimed: false });
  return {
    ...save,
    quests: {
      active: [quest('win-battles', 3), quest('deal-damage', 500), quest('clear-stage', 1)],
      lastIssuedDay: day,
    },
  };
}

describe('stage battle commit', () => {
  beforeEach(() => __resetSaveStoreForTests());

  it('applies applyBattleResult once, inside one update, with damage from the result', async () => {
    const before = questSave();
    await load(before);
    const outcome = commitStageBattle({ stage: 1, result: result('red', 240), teamIds: [PIKACHU] });
    if (!outcome) throw new Error('nothing recorded');
    const after = getSave();
    if (!after) throw new Error('no save');

    // Same as one pure applyBattleResult (now aside): ladder, capsules, dust, XP, counters.
    const expected = applyBattleResult(before, {
      stage: 1,
      won: true,
      damageDealt: 240,
      teamIds: [PIKACHU],
      now: after.meta.maxSeenTime,
    });
    expect(after.ladder).toEqual(expected.save.ladder);
    expect(after.capsules).toEqual(expected.save.capsules);
    expect(after.dust).toBe(expected.save.dust);
    expect(after.collection).toEqual(expected.save.collection);
    expect(after.meta.battleIndex).toBe(before.meta.battleIndex + 1);
    expect(outcome.summary.firstClear).toBe(true);
    expect(outcome.summary.outcome).toBe('won');

    // Events were folded once: battleWon +1, damage +240 — not doubled.
    const won = questRows(after).find((q) => q.kind === 'battleWon');
    const damage = questRows(after).find((q) => q.kind === 'damageDealt');
    expect(won?.progress).toBe(1);
    expect(damage?.progress).toBe(240);
    expect(after.quests).toEqual(expected.save.quests);
  });

  it('reports the quests the battle moved forward', async () => {
    await load(questSave());
    const outcome = commitStageBattle({ stage: 1, result: result('red'), teamIds: [PIKACHU] });
    expect(outcome?.quests).toEqual([
      expect.objectContaining({ id: 'win-battles', progress: 1, target: 3, completed: false }),
      expect.objectContaining({ id: 'deal-damage', progress: 120, completed: false }),
      expect.objectContaining({ id: 'clear-stage', progress: 1, completed: true }),
    ]);
  });

  it('records a loss without clearing the stage', async () => {
    await load(questSave());
    const outcome = commitStageBattle({ stage: 1, result: result('blue'), teamIds: [PIKACHU] });
    expect(outcome?.summary.outcome).toBe('lost');
    expect(getSave()?.ladder.cleared).toBe(0);
  });

  it('records nothing for a stage the save no longer unlocks', async () => {
    await load(questSave());
    const before = getSave();
    expect(commitStageBattle({ stage: 9, result: result('red'), teamIds: [PIKACHU] })).toBeNull();
    expect(getSave()).toBe(before);
  });

  it('diffs quest progress by id and day', () => {
    const before = questSave();
    const quest = before.quests.active[0];
    if (!quest) throw new Error('no quests');
    const after: Save = {
      ...before,
      quests: {
        ...before.quests,
        active: before.quests.active.map((q) =>
          q.id === quest.id ? { ...q, progress: q.target } : q,
        ),
      },
    };
    expect(questTicks(before, after)).toEqual([
      expect.objectContaining({ id: quest.id, progress: quest.target, completed: true }),
    ]);
    expect(questTicks(before, before)).toEqual([]);
  });
});

describe('intro step machine', () => {
  beforeEach(() => __resetSaveStoreForTests());

  const dealt = () =>
    makeSave({
      owned: [],
      team: [],
      onboarding: { step: 'dealt', loanerSpeciesId: PIKACHU, rivalSpeciesId: 19 },
    });

  it('dealt → fought: pays the intro reward once', async () => {
    await load(dealt());
    const summary = commitIntroWin(result('red'));
    expect(summary?.stage).toBe('intro');
    expect(getSave()?.onboarding.step).toBe('fought');
    expect(getSave()?.capsules.basic).toBe(economy.onboarding.introReward.capsules.basic);

    // A second call (StrictMode, a reload replaying the battle) pays nothing.
    expect(commitIntroWin(result('red'))).toBeNull();
    expect(getSave()?.capsules.basic).toBe(economy.onboarding.introReward.capsules.basic);
  });

  it('fought → capsule → done: the first Pokémon becomes the whole team', async () => {
    await load(dealt());
    commitIntroWin(result('red'));
    markCapsuleOpened();
    expect(getSave()?.onboarding.step).toBe('capsule');
    markCapsuleOpened();
    expect(getSave()?.onboarding.step).toBe('capsule');

    // Not owned yet: nothing happens.
    expect(finishOnboarding(BULBASAUR)).toBe(false);
    expect(getSave()?.onboarding.step).toBe('capsule');
  });

  it('finishes onboarding with an owned Pokémon only once', async () => {
    await load(
      makeSave({
        owned: [makeOwned(BULBASAUR)],
        team: [],
        onboarding: { step: 'capsule', loanerSpeciesId: PIKACHU, rivalSpeciesId: 19 },
      }),
    );
    expect(finishOnboarding(BULBASAUR)).toBe(true);
    expect(getSave()?.team).toEqual([BULBASAUR]);
    expect(getSave()?.onboarding.step).toBe('done');
    expect(finishOnboarding(BULBASAUR)).toBe(false);
  });

  it('writes a re-picked rival back only while the intro is still to be fought', async () => {
    await load(dealt());
    storeIntroRival(753);
    expect(getSave()?.onboarding.rivalSpeciesId).toBe(753);
    commitIntroWin(result('red'));
    storeIntroRival(19);
    expect(getSave()?.onboarding.rivalSpeciesId).toBe(753);
  });
});
