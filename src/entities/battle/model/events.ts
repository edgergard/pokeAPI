import type { Effectiveness, Move, Side } from './types';

export type FighterSummary = {
  fighterId: string;
  kos: number;
  damageDealt: number;
  damageTaken: number;
  survived: boolean;
};

export type BattleEndReason = 'knockout' | 'turnCap';

/** How a simulated battle ended, for the result screen and the save (wave 2 records it). */
export type BattleResult = {
  winner: Side;
  reason: BattleEndReason;
  /** Turns played: the turn of the final knockout, or the turn cap. */
  turns: number;
  /** Total damage dealt by Red's fighters (the `damageDealt` game event for the `deal-damage` quest). */
  redDamageDealt: number;
  /** Total damage dealt by Blue's fighters. */
  blueDamageDealt: number;
  /** Per-fighter numbers: Red's team then Blue's, each in slot order. */
  fighters: FighterSummary[];
};

export type BattleEvent =
  | { kind: 'enter'; turn: number; fighterId: string }
  | { kind: 'turnStart'; turn: number }
  | { kind: 'move'; turn: number; attackerId: string; targetId: string; move: Move }
  | { kind: 'miss'; turn: number; attackerId: string; targetId: string }
  | { kind: 'noEffect'; turn: number; attackerId: string; targetId: string }
  | {
      kind: 'hit';
      turn: number;
      attackerId: string;
      targetId: string;
      damage: number;
      effectiveness: Effectiveness;
      critical: boolean;
      hpBefore: number;
      hpAfter: number;
    }
  | { kind: 'ko'; turn: number; fighterId: string }
  | {
      kind: 'end';
      turn: number;
      winner: Side;
      reason: BattleEndReason;
      summary: FighterSummary[];
    };
