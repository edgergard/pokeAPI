import { BATTLE_LEVEL } from './stats';
import { effectiveness } from './typeChart';
import type { Effectiveness, Fighter, Move } from './types';

export const FALLBACK_MOVE: Move = {
  name: 'desperate-strike',
  type: 'typeless',
  power: 40,
  accuracy: 100,
  damageClass: 'physical',
};

const CRIT_CHANCE = 1 / 24;

function stab(attacker: Fighter, move: Move): number {
  return move.type !== 'typeless' && attacker.types.includes(move.type) ? 1.5 : 1;
}

/** Rolls crit first, then the random factor; immunity consumes no rng. */
export function calcDamage(
  attacker: Fighter,
  defender: Fighter,
  move: Move,
  rng: () => number,
): { damage: number; effectiveness: Effectiveness; critical: boolean } {
  const eff = effectiveness(move.type, defender.types);
  if (eff === 0) return { damage: 0, effectiveness: eff, critical: false };

  const physical = move.damageClass === 'physical';
  const a = physical ? attacker.stats.attack : attacker.stats.specialAttack;
  const d = physical ? defender.stats.defense : defender.stats.specialDefense;
  const levelTerm = Math.floor((2 * BATTLE_LEVEL) / 5 + 2);
  const base = Math.floor(Math.floor((levelTerm * move.power * a) / d) / 50) + 2;

  const critical = rng() < CRIT_CHANCE;
  const random = 0.85 + 0.15 * rng();
  const raw = base * stab(attacker, move) * eff * (critical ? 1.5 : 1) * random;
  return { damage: Math.max(1, Math.floor(raw)), effectiveness: eff, critical };
}

/** Picks a move weighted by expected damage; unusable moves are excluded unless all are. */
export function chooseMove(attacker: Fighter, defender: Fighter, rng: () => number): Move {
  const candidates = attacker.moves.map((move) => ({
    move,
    weight:
      move.power *
      stab(attacker, move) *
      effectiveness(move.type, defender.types) *
      ((move.accuracy ?? 100) / 100),
  }));
  if (candidates.length === 0) return FALLBACK_MOVE;
  const usable = candidates.filter((c) => c.weight > 0);
  if (usable.length === 0)
    return candidates[Math.floor(rng() * candidates.length)]?.move ?? FALLBACK_MOVE;
  let roll = rng() * usable.reduce((s, c) => s + c.weight, 0);
  for (const c of usable) {
    roll -= c.weight;
    if (roll < 0) return c.move;
  }
  return usable[usable.length - 1]?.move ?? FALLBACK_MOVE;
}
