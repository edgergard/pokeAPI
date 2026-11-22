import { getSpecies } from '@/entities/pokemon';
import { applyGameEvents, type GameEvent, type OwnedPokemon, type Save } from '@/entities/save';
import { economy, type CapsuleTier, type Reward } from '@/shared/config/economy';
import { createRng, hashSeed } from '@/shared/lib/rng';
import { floorSafe, withPercent } from './math';
import { addPokemonXp, levelCap, pokemonTalentPointsAt } from './pokemonLevel';
import {
  effectiveReward,
  emptyReward,
  grantReward,
  sumRewards,
  type GrantedReward,
} from './rewards';
import { trainerBonuses } from './talentCatalog';
import { addTrainerXp, type TrainerUnlock } from './trainerLevel';

/** The capsule a replay streak or the trainer `capsuleChance` talent gives. */
const BONUS_CAPSULE: Reward = economy.battle.bonusCapsuleReward;

export type BattleInput = {
  /** Ladder stage (1..economy.battle.ladderStages, at most `ladder.cleared + 1`) or the onboarding intro. */
  stage: number | 'intro';
  won: boolean;
  /** Total damage the player's side dealt (battle result `redDamageDealt`). */
  damageDealt: number;
  /** Species ids that fought on the player's side (ids not in the collection get nothing). */
  teamIds: readonly number[];
  /** Wall-clock ms; also raises `meta.maxSeenTime` (the daily-quest clock guard). */
  now: number;
};

export type PokemonBattleResult = {
  speciesId: number;
  /** True for collection Pokémon that didn't fight (they get the bench share). */
  bench: boolean;
  /** XP awarded (XP past the level cap is lost). */
  xp: number;
  fromLevel: number;
  toLevel: number;
  /** XP towards the next level before / after. */
  fromXp: number;
  toXp: number;
  levelsGained: number;
  /** Ends at its star level cap. */
  atCap: boolean;
  levelCap: number;
  talentPointsGained: number;
};

export type TrainerBattleResult = {
  xp: number;
  fromLevel: number;
  toLevel: number;
  fromXp: number;
  toXp: number;
  levelsGained: number;
  talentPointsGained: number;
  /** Concatenated unlocks of every level gained (level-up dialog). */
  unlocks: TrainerUnlock[];
  /** Ends at the trainer max level. */
  atMax: boolean;
};

/** Everything the battle result overlay and the level-up dialog show. */
export type BattleSummary = {
  outcome: 'won' | 'lost';
  stage: number | 'intro';
  /** First time this stage was cleared (first-clear bonus granted). */
  firstClear: boolean;
  trainer: TrainerBattleResult;
  /** XP each team member was awarded (0 for the intro). */
  teamXp: number;
  /** XP each bench Pokémon was awarded (0 for the intro). */
  benchXp: number;
  /** Team members first (in `teamIds` order), then the bench. */
  pokemon: PokemonBattleResult[];
  /** Capsules granted per tier, from every source (first clear, replay streak, bonus, intro). */
  capsules: Record<CapsuleTier, number>;
  /** Dust granted, after the trainer dust bonus. */
  dust: number;
  /** The trainer `capsuleChance` roll gave a bonus capsule. */
  bonusCapsule: boolean;
  /** Replay streak after this battle (`wins` of `every`); null for the intro. */
  replay: { wins: number; every: number; capsuleEarned: boolean } | null;
  events: GameEvent[];
};

export type BattleResult = { save: Save; summary: BattleSummary };

function assertStage(save: Save, stage: number): void {
  const max = economy.battle.ladderStages;
  if (!Number.isInteger(stage) || stage < 1 || stage > max) {
    throw new RangeError(`Stage ${stage} is outside 1..${max}`);
  }
  if (stage > save.ladder.cleared + 1) {
    throw new RangeError(`Stage ${stage} is locked (cleared: ${save.ladder.cleared})`);
  }
}

function stageXp(
  table: { base: number; perStage: number; lossShare: number },
  stage: number,
  won: boolean,
): number {
  const full = table.base + table.perStage * stage;
  return won ? full : floorSafe(full * table.lossShare);
}

/**
 * Applies a finished battle to the save: XP for the team, the bench and the trainer, ladder progress,
 * first-clear / replay / bonus capsules, battle counters and game events (folded in with
 * `applyGameEvents`). Throws on a stage that is out of range or not unlocked yet (programming error).
 */
export function applyBattleResult(save: Save, input: BattleInput): BattleResult {
  const { stage, won } = input;
  const damage = Math.max(0, Math.floor(input.damageDealt));
  if (stage !== 'intro') assertStage(save, stage);

  let next = save;
  let granted: GrantedReward = emptyReward();
  const grant = (reward: Reward) => {
    granted = sumRewards(granted, effectiveReward(next, reward));
    next = grantReward(next, reward);
  };

  let firstClear = false;
  let bonusCapsule = false;
  let replay: BattleSummary['replay'] = null;
  let teamXp = 0;
  let benchXp = 0;
  let trainerXp = 0;
  const pokemon: PokemonBattleResult[] = [];
  const levelEvents: GameEvent[] = [];
  const stageEvents: GameEvent[] = [];

  if (stage === 'intro') {
    // The scripted intro always pays out its reward; the loaner isn't owned, so no XP.
    grant(economy.onboarding.introReward);
  } else {
    const bonuses = trainerBonuses(save.trainer.talents);
    trainerXp = stageXp(economy.battle.trainerXp, stage, won);
    teamXp = withPercent(stageXp(economy.battle.pokemonXp, stage, won), bonuses.xpPercent);
    benchXp = floorSafe(teamXp * (economy.pokemon.benchXpShare + bonuses.benchXpPercent / 100));

    // Pokémon XP: team members in order, then every other owned Pokémon as the bench.
    const team = [...new Set(input.teamIds)].filter((id) => save.collection[String(id)]);
    const teamSet = new Set(team);
    const bench = Object.keys(save.collection)
      .map(Number)
      .filter((id) => !teamSet.has(id));
    const collection: Record<string, OwnedPokemon> = { ...save.collection };
    let collectionChanged = false;
    for (const [id, isBench] of [
      ...team.map((id) => [id, false] as const),
      ...bench.map((id) => [id, true] as const),
    ]) {
      const owned = collection[String(id)];
      const species = getSpecies(id);
      if (!owned || !species) continue;
      const xp = isBench ? benchXp : teamXp;
      const result = addPokemonXp(owned, species, xp);
      if (result.owned !== owned) {
        collection[String(id)] = result.owned;
        collectionChanged = true;
      }
      for (let level = owned.level + 1; level <= result.owned.level; level++) {
        levelEvents.push({ kind: 'pokemonLeveled', speciesId: id, level });
      }
      pokemon.push({
        speciesId: id,
        bench: isBench,
        xp,
        fromLevel: owned.level,
        toLevel: result.owned.level,
        fromXp: owned.xp,
        toXp: result.owned.xp,
        levelsGained: result.levelsGained,
        atCap: result.atCap,
        levelCap: levelCap(owned.stars),
        talentPointsGained:
          pokemonTalentPointsAt(result.owned.level) - pokemonTalentPointsAt(owned.level),
      });
    }
    if (collectionChanged) next = { ...next, collection };

    if (won) {
      if (stage === save.ladder.cleared + 1) {
        firstClear = true;
        grant(economy.battle.firstClear);
        next = { ...next, ladder: { ...next.ladder, cleared: stage } };
        stageEvents.push({ kind: 'stageCleared', stage });
      } else {
        const every = economy.battle.replayCapsuleEveryWins;
        const wins = next.ladder.replayWins + 1;
        const capsuleEarned = wins >= every;
        if (capsuleEarned) grant(BONUS_CAPSULE);
        next = { ...next, ladder: { ...next.ladder, replayWins: capsuleEarned ? 0 : wins } };
        replay = { wins: next.ladder.replayWins, every, capsuleEarned };
      }
      if (bonuses.capsuleChance > 0) {
        const roll = createRng(hashSeed(save.meta.seed, 'battle-bonus', save.meta.battleIndex))();
        if (roll * 100 < bonuses.capsuleChance) {
          bonusCapsule = true;
          grant(BONUS_CAPSULE);
        }
      }
    }
    replay ??= {
      wins: next.ladder.replayWins,
      every: economy.battle.replayCapsuleEveryWins,
      capsuleEarned: false,
    };
  }

  const fromTrainer = next.trainer;
  const trainerResult = addTrainerXp(next, trainerXp);
  next = trainerResult.save;
  for (let level = fromTrainer.level + 1; level <= next.trainer.level; level++) {
    levelEvents.push({ kind: 'trainerLeveled', level });
  }

  next = {
    ...next,
    meta: {
      ...next.meta,
      battleIndex: next.meta.battleIndex + 1,
      battlesSinceExport: next.meta.battlesSinceExport + 1,
      maxSeenTime: Math.max(next.meta.maxSeenTime, Math.floor(input.now)),
    },
  };

  const events: GameEvent[] = [
    won ? { kind: 'battleWon', stage } : { kind: 'battleLost', stage },
    ...stageEvents,
    ...(damage > 0 ? [{ kind: 'damageDealt', amount: damage } as const] : []),
    ...levelEvents,
  ];
  next = applyGameEvents(next, events);

  return {
    save: next,
    summary: {
      outcome: won ? 'won' : 'lost',
      stage,
      firstClear,
      trainer: {
        xp: trainerXp,
        fromLevel: fromTrainer.level,
        toLevel: trainerResult.save.trainer.level,
        fromXp: fromTrainer.xp,
        toXp: trainerResult.save.trainer.xp,
        levelsGained: trainerResult.levelsGained,
        talentPointsGained: trainerResult.talentPointsGained,
        unlocks: trainerResult.unlocks,
        atMax: trainerResult.save.trainer.level >= economy.trainer.maxLevel,
      },
      teamXp,
      benchXp,
      pokemon,
      capsules: granted.capsules,
      dust: granted.dust,
      bonusCapsule,
      replay,
      events,
    },
  };
}
