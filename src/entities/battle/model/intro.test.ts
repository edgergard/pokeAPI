import { beforeAll, describe, expect, it } from 'vitest';
import { allSpecies, getSpecies, type Species } from '@/entities/pokemon';
import { economy } from '@/shared/config/economy';
import { createRng, hashSeed } from '@/shared/lib/rng';
import { loadMovesets } from '../api/movesets';
import { buildFighter } from './buildFighter';
import { FALLBACK_MOVE } from './damage';
import {
  findIntroSeed,
  INTRO_SEED_SEARCH_LIMIT,
  INTRO_TARGET_TURNS,
  IntroSeedError,
} from './intro';
import type { MovesetData } from './prepare';
import { simulateBattle } from './simulate';
import { statsAtLevel } from './stats';
import { effectiveness } from './typeChart';
import type { BattleTeam, Side } from './types';

let movesets: MovesetData;
beforeAll(async () => {
  movesets = await loadMovesets();
});

const { loanerLevel, rivalLevel } = economy.onboarding;

/** A one-fighter team; `statsAtLevel` stands in for progression's computeStats (IV 31, no nature). */
const solo = (side: Side, species: Species, level: number): BattleTeam => ({
  side,
  trainerName: side,
  fighters: [
    buildFighter({
      species,
      level,
      stats: statsAtLevel(species.stats, level),
      movesets,
      side,
      slot: 0,
      badges: { stars: 1, talentIcons: [] },
    }),
  ],
});

const byId = (id: number): Species => {
  const s = getSpecies(id);
  if (!s) throw new Error(`no species ${id}`);
  return s;
};

const introSeeds = new Set(
  Array.from({ length: INTRO_SEED_SEARCH_LIMIT }, (_, n) => hashSeed('intro', n)),
);

/** Red has at least one move (or the fallback strike) that affects Blue's lead. */
const canHurt = (red: BattleTeam, blue: BattleTeam): boolean => {
  const [r] = red.fighters;
  const [b] = blue.fighters;
  if (!r || !b) return false;
  const moves = r.moves.length > 0 ? r.moves : [FALLBACK_MOVE];
  return moves.some((m) => effectiveness(m.type, b.types) > 0);
};

/** A fixed sample of common-rarity matchups: loaner at loanerLevel vs rival at rivalLevel. */
function samplePairs(count: number): [Species, Species][] {
  const pool = allSpecies.filter((s) => s.rarity === 'common');
  const rng = createRng(hashSeed('intro-test'));
  const pick = () => pool[Math.floor(rng() * pool.length)] ?? byId(25);
  return Array.from({ length: count }, () => [pick(), pick()]);
}

describe('findIntroSeed', () => {
  it('returns a hashSeed("intro", n) seed where Red wins by knockout, across sampled matchups', () => {
    let immune = 0;
    for (const [loaner, rival] of samplePairs(60)) {
      const red = solo('red', loaner, loanerLevel);
      const blue = solo('blue', rival, rivalLevel);
      if (!canHurt(red, blue)) {
        // Every move of the loaner has no effect on the rival's types: no seed can win.
        immune += 1;
        expect(() => findIntroSeed(red, blue)).toThrow(IntroSeedError);
        continue;
      }
      const seed = findIntroSeed(red, blue);
      expect(introSeeds.has(seed)).toBe(true);
      const { result } = simulateBattle(red, blue, seed);
      expect(result).toMatchObject({ winner: 'red', reason: 'knockout' });
    }
    expect(immune).toBeLessThan(6);
  });

  it('wins for the classic starters against early rivals', () => {
    for (const loaner of [1, 4, 7, 25]) {
      for (const rival of [16, 19, 21, 10, 13]) {
        const red = solo('red', byId(loaner), loanerLevel);
        const blue = solo('blue', byId(rival), rivalLevel);
        const { result } = simulateBattle(red, blue, findIntroSeed(red, blue));
        expect(result).toMatchObject({ winner: 'red', reason: 'knockout' });
      }
    }
  });

  it('is deterministic and prefers the turn count closest to the target', () => {
    const red = solo('red', byId(25), loanerLevel);
    const blue = solo('blue', byId(19), rivalLevel);
    const seed = findIntroSeed(red, blue);
    expect(findIntroSeed(red, blue)).toBe(seed);

    const turnsOf = (s: number) => simulateBattle(red, blue, s).result.turns;
    const wins = [...introSeeds].filter((s) => {
      const { result } = simulateBattle(red, blue, s);
      return result.winner === 'red' && result.reason === 'knockout';
    });
    const best = Math.min(...wins.map((s) => Math.abs(turnsOf(s) - INTRO_TARGET_TURNS)));
    expect(Math.abs(turnsOf(seed) - INTRO_TARGET_TURNS)).toBe(best);
    // …and it is the first seed (lowest n) with that distance.
    const first = wins.find((s) => Math.abs(turnsOf(s) - INTRO_TARGET_TURNS) === best);
    expect(seed).toBe(first);
  });

  it('throws a typed error when Red can never win (every move has no effect)', () => {
    // Here Pikachu knows only an Electric move, which can't touch a Ground type.
    const sparky: MovesetData = {
      moves: { thunderbolt: ['electric', 90, 100, 'special'] },
      sets: { pikachu: ['thunderbolt'] },
    };
    const red: BattleTeam = {
      side: 'red',
      trainerName: 'red',
      fighters: [
        buildFighter({
          species: byId(25),
          level: loanerLevel,
          stats: statsAtLevel(byId(25).stats, loanerLevel),
          movesets: sparky,
          side: 'red',
          slot: 0,
          badges: { stars: 1, talentIcons: [] },
        }),
      ],
    };
    const blue = solo('blue', byId(50), rivalLevel); // Diglett (Ground)
    expect(() => findIntroSeed(red, blue)).toThrow(IntroSeedError);
    try {
      findIntroSeed(red, blue);
    } catch (e) {
      expect(e).toMatchObject({ red: 'Pikachu', blue: 'Diglett', tried: INTRO_SEED_SEARCH_LIMIT });
    }
  });
});
