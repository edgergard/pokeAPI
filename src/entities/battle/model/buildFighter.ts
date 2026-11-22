import { getCreatureArt, type Species } from '@/entities/pokemon';
import { movesFor, type MovesetData } from './prepare';
import { MAX_TEAM_SIZE } from './simulate';
import type { BattleStats, BattleTeam, Fighter, FighterBadges, Side } from './types';

/** One fighter's ingredients, all prepared by the caller (no fetching, no stat maths here). */
export type FighterSpec = {
  species: Species;
  level: number;
  /**
   * Final battle stats: level, IVs, nature and stat talents already applied (stream 1-progression's
   * `computeStats()` has this shape). Used as-is.
   */
  stats: BattleStats;
  /** Baked movesets (`loadMovesets()`); the species' moves are looked up by `species.slug`. */
  movesets: MovesetData;
  side: Side;
  /** 0 = lead; the rest wait on the bench in slot order. */
  slot: number;
  badges: FighterBadges;
  /** Folded from `critChance` talents: percentage points added to the base crit chance. */
  critChanceBonus?: number;
  /** Folded from a `firstStrike` talent. */
  firstStrike?: boolean;
};

/**
 * A battle fighter from a baked species. Moves come from the movesets by `species.slug` (a species
 * without a moveset still fights, with FALLBACK_MOVE), artwork from `getCreatureArt`.
 */
export function buildFighter(spec: FighterSpec): Fighter {
  const { species, side, slot } = spec;
  if (!Number.isInteger(slot) || slot < 0 || slot >= MAX_TEAM_SIZE)
    throw new RangeError(`buildFighter: slot must be 0–${MAX_TEAM_SIZE - 1}, got ${slot}`);
  if (!Number.isInteger(spec.level) || spec.level < 1)
    throw new RangeError(`buildFighter: level must be a positive integer, got ${spec.level}`);
  const fighter: Fighter = {
    id: `${side}-${slot}`,
    side,
    slot,
    name: species.name,
    pokemonId: species.id,
    types: [...species.types],
    artwork: getCreatureArt(species.id, 'artwork'),
    level: spec.level,
    badges: { stars: spec.badges.stars, talentIcons: [...spec.badges.talentIcons] },
    stats: { ...spec.stats },
    moves: movesFor(spec.movesets, species.slug),
  };
  if (spec.critChanceBonus !== undefined) fighter.critChanceBonus = spec.critChanceBonus;
  if (spec.firstStrike !== undefined) fighter.firstStrike = spec.firstStrike;
  return fighter;
}

/** A team's fighter ingredients without the parts `buildTeam` fills in (side, slot, movesets). */
export type TeamMemberSpec = Omit<FighterSpec, 'side' | 'slot' | 'movesets'>;

/** A whole side: members in slot order (lead first). */
export function buildTeam(opts: {
  side: Side;
  trainerName: string;
  members: TeamMemberSpec[];
  movesets: MovesetData;
}): BattleTeam {
  const { side, trainerName, members, movesets } = opts;
  return {
    side,
    trainerName,
    fighters: members.map((member, slot) => buildFighter({ ...member, side, slot, movesets })),
  };
}
