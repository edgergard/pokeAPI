// Public API of the battle entity — other layers import only from here.
export type {
  BattleStats,
  BattleTeam,
  Effectiveness,
  Fighter,
  Move,
  MoveType,
  Side,
} from './model/types';
export { createRng } from './model/rng';
export { effectiveness } from './model/typeChart';
export { BATTLE_LEVEL, statsAtLevel } from './model/stats';
export type { BattleEvent, FighterSummary } from './model/events';
export { calcDamage, chooseMove, FALLBACK_MOVE } from './model/damage';
export { simulateBattle } from './model/simulate';
export { selectMoves } from './model/selectMoves';
export { movesFor, prepareTeam, toFighter } from './model/prepare';
export type { MovesetData, TeamChoice } from './model/prepare';
export { loadMovesets } from './api/movesets';
