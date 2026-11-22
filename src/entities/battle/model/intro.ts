import { hashSeed } from '@/shared/lib/rng';
import { simulateBattle } from './simulate';
import type { BattleTeam } from './types';

/**
 * How many intro seeds `findIntroSeed` tries: `hashSeed('intro', n)` for n = 0 … limit − 1.
 * A search bound, not a game number: a 1×1 simulation takes microseconds, so the full scan stays
 * within a few milliseconds.
 */
export const INTRO_SEED_SEARCH_LIMIT = 512;

/**
 * The turn count the onboarding battle aims for. The arena plays the intro with full exchanges
 * (`intro` mode): about 7.6 s of fixed beats (intro, deal-ins, KO, victory) plus ~1.5 s per
 * exchange, two exchanges a turn, so six turns ≈ 25 s at 1× (design.md flow first-visit step 3).
 */
export const INTRO_TARGET_TURNS = 6;

/** No `hashSeed('intro', n)` within the search bound lets Red win by knockout. */
export class IntroSeedError extends Error {
  constructor(
    readonly red: string,
    readonly blue: string,
    readonly tried: number,
  ) {
    super(
      `findIntroSeed: ${red} never beats ${blue} by knockout in ${tried} seeds (hashSeed('intro', 0…${tried - 1}))`,
    );
    this.name = 'IntroSeedError';
  }
}

const teamLabel = (team: BattleTeam) => team.fighters.map((f) => f.name).join(', ') || team.side;

/**
 * The seed for the scripted onboarding battle (Must #1): Red always wins.
 *
 * Tries `hashSeed('intro', n)` for n = 0, 1, 2, … below INTRO_SEED_SEARCH_LIMIT and keeps the seeds
 * where Red wins by knockout. Of those it returns the first whose turn count is closest to
 * INTRO_TARGET_TURNS (an exact hit ends the search early), so the playback lands as near ~25 s as
 * the matchup allows. Deterministic: the same teams always get the same seed.
 *
 * Throws an `IntroSeedError` when no seed in the bound lets Red win: Red can't hurt Blue at all
 * (every Red move has no effect on Blue's types) or Blue is far too strong for Red's level. Callers
 * pick another rival then. Also throws `simulateBattle`'s TeamSizeError for invalid teams.
 */
export function findIntroSeed(red: BattleTeam, blue: BattleTeam): number {
  let best: { seed: number; distance: number } | null = null;
  for (let n = 0; n < INTRO_SEED_SEARCH_LIMIT; n++) {
    const seed = hashSeed('intro', n);
    const { result } = simulateBattle(red, blue, seed);
    if (result.winner !== 'red' || result.reason !== 'knockout') continue;
    const distance = Math.abs(result.turns - INTRO_TARGET_TURNS);
    if (distance === 0) return seed;
    if (!best || distance < best.distance) best = { seed, distance };
  }
  if (!best) throw new IntroSeedError(teamLabel(red), teamLabel(blue), INTRO_SEED_SEARCH_LIMIT);
  return best.seed;
}
