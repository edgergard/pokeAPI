// Public API of the battle entity — other layers import only from here.
export type {
  BattleStats,
  BattleTeam,
  Effectiveness,
  Fighter,
  FighterBadges,
  Move,
  MoveType,
  Side,
} from './model/types';
export { createRng } from './model/rng';
export { effectiveness } from './model/typeChart';
export { BATTLE_LEVEL, statsAtLevel } from './model/stats';
export type { BattleEndReason, BattleEvent, BattleResult, FighterSummary } from './model/events';
export {
  BASE_CRIT_CHANCE,
  calcDamage,
  chooseMove,
  critChance,
  FALLBACK_MOVE,
} from './model/damage';
export {
  assertTeamSizes,
  MAX_TEAM_SIZE,
  MIN_TEAM_SIZE,
  simulateBattle,
  TeamSizeError,
} from './model/simulate';
export {
  buildFighter,
  buildTeam,
  type FighterSpec,
  type TeamMemberSpec,
} from './model/buildFighter';
export {
  findIntroSeed,
  INTRO_SEED_SEARCH_LIMIT,
  INTRO_TARGET_TURNS,
  IntroSeedError,
} from './model/intro';
export { selectMoves } from './model/selectMoves';
export { movesFor, prepareTeam, toFighter } from './model/prepare';
export type { MovesetData, TeamChoice } from './model/prepare';
export { loadMovesets } from './api/movesets';
