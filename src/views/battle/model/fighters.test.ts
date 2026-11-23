import { beforeAll, describe, expect, it } from 'vitest';
import {
  findIntroSeed,
  loadMovesets,
  movesFor,
  simulateBattle,
  statsAtLevel,
  type MovesetData,
} from '@/entities/battle';
import { stageInfo } from '@/entities/ladder';
import { makeOwned, makeSave } from '@/entities/ladder/testing/testSave';
import { getSpecies, speciesOfRarity } from '@/entities/pokemon';
import { computeStats, talentModifiers } from '@/entities/progression';
import { economy } from '@/shared/config/economy';
import { createRng, hashSeed } from '@/shared/lib/rng';
import {
  battleSeed,
  buildStageTeams,
  playerLineup,
  RIVAL_PICK_LIMIT,
  setupIntro,
  stageLineups,
} from './fighters';

const PIKACHU = 25;
const BULBASAUR = 1;
const CHARMANDER = 4;
const SQUIRTLE = 7;
const RATTATA = 19;
const GASTLY = 92;

let movesets: MovesetData;
beforeAll(async () => {
  movesets = await loadMovesets();
});

describe('fighters from the save', () => {
  it('builds stats with computeStats and folds talents into the engine modifiers', () => {
    const owned = makeOwned(PIKACHU, {
      level: 15,
      stars: 2,
      nature: 'timid',
      talents: ['offense-1', 'offense-2', 'offense-3', 'tempo-1', 'tempo-2', 'tempo-3', 'tempo-4'],
    });
    const save = makeSave({ owned: [owned], trainer: { talents: ['quick-draw'] } });
    const { members, ids } = playerLineup(save, save.team);
    const species = getSpecies(PIKACHU);
    if (!species) throw new Error('species data');
    const modifiers = talentModifiers(owned, save.trainer.talents);
    expect(ids).toEqual([PIKACHU]);
    expect(members[0]).toMatchObject({
      level: 15,
      stats: computeStats(species, owned),
      badges: { stars: 2, talentIcons: ['offense', 'tempo'] },
      critChanceBonus: modifiers.critChance,
      firstStrike: modifiers.firstStrike,
    });
    // offense-3 (5) + tempo-3 (3) + the trainer's quick-draw (3); tempo-4 grants first strike.
    expect(modifiers).toEqual({ critChance: 11, firstStrike: true });
  });

  it('skips ids that are not owned and repeats', () => {
    const save = makeSave({ owned: [makeOwned(PIKACHU)], team: [PIKACHU, 999, PIKACHU] });
    expect(playerLineup(save, save.team).ids).toEqual([PIKACHU]);
  });

  it('fights k×k with k = min(your team, the rival team): the engine needs equal sizes', () => {
    // Stage 1: rival of 1. A team of 3 fields its lead only.
    const big = makeSave({
      owned: [makeOwned(PIKACHU), makeOwned(BULBASAUR), makeOwned(CHARMANDER)],
      trainer: { level: 5 },
    });
    const one = stageLineups(big, 1);
    expect(one.size).toBe(1);
    expect(one.red.ids).toEqual([PIKACHU]);
    expect(one.trimmed).toBe(true);

    // The last stage: rival of 4. A team of 2 meets the rival's first 2.
    const small = makeSave({
      owned: [makeOwned(PIKACHU), makeOwned(BULBASAUR)],
      ladder: { cleared: economy.battle.ladderStages - 1 },
    });
    const last = stageLineups(small, economy.battle.ladderStages);
    const info = stageInfo(economy.battle.ladderStages);
    expect(last.size).toBe(2);
    expect(last.blue.ids).toEqual(info.rival.slice(0, 2).map((m) => m.speciesId));

    const empty = stageLineups(makeSave({ owned: [makeOwned(PIKACHU)], team: [] }), 1);
    expect(empty.size).toBe(0);
  });

  it('gives rivals engine stats at the stage level and the stage rival name', () => {
    const save = makeSave({
      owned: [makeOwned(PIKACHU), makeOwned(BULBASAUR), makeOwned(CHARMANDER), makeOwned(SQUIRTLE)],
      trainer: { level: 10 },
      ladder: { cleared: 20 },
    });
    const lineups = stageLineups(save, 20);
    const info = stageInfo(20);
    expect(lineups.rivalName).toBe(info.rivalName);
    lineups.blue.members.forEach((m, i) => {
      const member = info.rival[i];
      expect(m.level).toBe(member?.level);
      expect(m.stats).toEqual(statsAtLevel(m.species.stats, m.level));
      expect(m.badges).toEqual({ stars: member?.stars, talentIcons: [] });
    });
    const teams = buildStageTeams(lineups, save.trainer.name, movesets);
    expect(teams.red.trainerName).toBe(save.trainer.name);
    expect(teams.blue.trainerName).toBe(info.rivalName);
    expect(teams.red.fighters).toHaveLength(teams.blue.fighters.length);
    // Equal sizes: the engine accepts them.
    expect(() => simulateBattle(teams.red, teams.blue, battleSeed(save))).not.toThrow();
  });

  it('seeds a battle from the save seed and battle index', () => {
    const save = makeSave({ seed: 99 });
    expect(battleSeed(save)).toBe(hashSeed(99, 'battle', 0));
    expect(battleSeed({ meta: { ...save.meta, battleIndex: 3 } })).toBe(hashSeed(99, 'battle', 3));
  });
});

describe('intro setup', () => {
  const dealt = (loaner: number, rival: number, seed = 7) =>
    makeSave({
      seed,
      onboarding: { step: 'dealt', loanerSpeciesId: loaner, rivalSpeciesId: rival },
    });

  it('pits the loaner (onboarding loaner level) against the dealt rival, seeded to win', () => {
    const setup = setupIntro(dealt(PIKACHU, RATTATA), movesets);
    if (!setup) throw new Error('no intro');
    expect(setup.rivalId).toBe(RATTATA);
    const [red] = setup.red.fighters;
    const [blue] = setup.blue.fighters;
    expect(red?.level).toBe(economy.onboarding.loanerLevel);
    expect(blue?.level).toBe(economy.onboarding.rivalLevel);
    expect(red?.badges).toEqual({ stars: 1, talentIcons: [] });
    const pikachu = getSpecies(PIKACHU);
    expect(red?.stats).toEqual(
      pikachu && statsAtLevel(pikachu.stats, economy.onboarding.loanerLevel),
    );
    expect(setup.seed).toBe(findIntroSeed(setup.red, setup.blue));
    expect(simulateBattle(setup.red, setup.blue, setup.seed).result.winner).toBe('red');
  });

  it('re-picks the rival deterministically when the loaner cannot win (IntroSeedError)', () => {
    // Rattata only knows normal moves; Gastly is a ghost: no seed lets Rattata win.
    const save = dealt(RATTATA, GASTLY, 7);
    const setup = setupIntro(save, movesets);
    if (!setup) throw new Error('no intro');
    expect(setup.rivalId).not.toBe(GASTLY);
    expect(setupIntro(save, movesets)).toEqual(setup);

    const loaner = getSpecies(RATTATA);
    const candidates = speciesOfRarity('common').filter(
      (s) => movesFor(movesets, s.slug).length > 0 && loaner && s.bst <= loaner.bst,
    );
    const picks = Array.from({ length: RIVAL_PICK_LIMIT }, (_, k) => {
      const roll = createRng(hashSeed(save.meta.seed, 'rival', k))();
      return candidates[Math.floor(roll * candidates.length)]?.id;
    });
    expect(picks).toContain(setup.rivalId);
    const chosen = getSpecies(setup.rivalId);
    expect(chosen?.rarity).toBe('common');
    expect(simulateBattle(setup.red, setup.blue, setup.seed).result.winner).toBe('red');
  });

  it('returns null when the dealt species are missing', () => {
    const save = makeSave({
      onboarding: { step: 'dealt', loanerSpeciesId: null, rivalSpeciesId: 19 },
    });
    expect(setupIntro(save, movesets)).toBeNull();
  });
});
