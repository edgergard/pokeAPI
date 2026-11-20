import type { BattleStats } from './types';

export const BATTLE_LEVEL = 50;

/** Stats at `level` with IV 31, EV 0 and no nature. */
export function statsAtLevel(base: BattleStats, level: number = BATTLE_LEVEL): BattleStats {
  const core = (b: number) => Math.floor(((2 * b + 31) * level) / 100);
  const other = (b: number) => core(b) + 5;
  return {
    hp: core(base.hp) + level + 10,
    attack: other(base.attack),
    defense: other(base.defense),
    specialAttack: other(base.specialAttack),
    specialDefense: other(base.specialDefense),
    speed: other(base.speed),
  };
}
