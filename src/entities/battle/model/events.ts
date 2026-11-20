import type { Effectiveness, Move, Side } from './types';

export type FighterSummary = {
  fighterId: string;
  kos: number;
  damageDealt: number;
  damageTaken: number;
  survived: boolean;
};

export type BattleEvent =
  | { kind: 'enter'; turn: number; fighterId: string }
  | { kind: 'turnStart'; turn: number }
  | { kind: 'move'; turn: number; attackerId: string; targetId: string; move: Move }
  | { kind: 'miss'; turn: number; attackerId: string; targetId: string }
  | { kind: 'noEffect'; turn: number; attackerId: string; targetId: string }
  | {
    kind: 'hit'; turn: number; attackerId: string; targetId: string; damage: number;
    effectiveness: Effectiveness; critical: boolean; hpBefore: number; hpAfter: number;
  }
  | { kind: 'ko'; turn: number; fighterId: string }
  | { kind: 'end'; turn: number; winner: Side; reason: 'knockout' | 'turnCap'; summary: FighterSummary[] };
