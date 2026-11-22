import { calcDamage, chooseMove } from './damage';
import type { BattleEndReason, BattleEvent, BattleResult, FighterSummary } from './events';
import { createRng } from './rng';
import type { BattleTeam, Fighter, Side } from './types';

/** Fighters per side: 1×1 up to 4×4 (the trainer's team slots, economy.trainer.teamSlots). */
export const MIN_TEAM_SIZE = 1;
export const MAX_TEAM_SIZE = 4;

const DEFAULT_TURN_CAP = 40;

/** Thrown by `simulateBattle` for teams it cannot pit against each other. */
export class TeamSizeError extends RangeError {
  constructor(message: string) {
    super(message);
    this.name = 'TeamSizeError';
  }
}

/** Throws a TeamSizeError unless both teams hold the same number of fighters, 1–4. */
export function assertTeamSizes(red: BattleTeam, blue: BattleTeam): void {
  for (const team of [red, blue]) {
    const n = team.fighters.length;
    if (n < MIN_TEAM_SIZE || n > MAX_TEAM_SIZE)
      throw new TeamSizeError(
        `simulateBattle: each team needs ${MIN_TEAM_SIZE}–${MAX_TEAM_SIZE} fighters, ${team.side} has ${n}`,
      );
  }
  if (red.fighters.length !== blue.fighters.length)
    throw new TeamSizeError(
      `simulateBattle: teams must be the same size (red ${red.fighters.length}, blue ${blue.fighters.length})`,
    );
}

type SideState = { team: BattleTeam; active: number; entered: boolean };

/**
 * Plays a whole battle up front, deterministically: the same teams and seed always give the same
 * events and result (all randomness comes from `createRng(seed)`).
 *
 * Teams: N×N with 1 ≤ N ≤ 4 and both sides the same size; anything else throws a `TeamSizeError`.
 * Each side fights as a relay in slot order: slot 0 is the active fighter, the rest wait on the
 * bench, and a knocked-out fighter is replaced by the next slot at the start of the following turn.
 *
 * Each turn both actives act once, faster first (a speed tie is a coin flip). A fighter with
 * `firstStrike` acts first in its first turn on the field, whatever the speeds; when both actives
 * have it that turn, the speed order decides. `critChanceBonus` raises the attacker's crit chance.
 *
 * The battle ends when one side has no fighters left (`knockout`), or after `turnCap` turns
 * (default 40), when the side with the larger share of its team's total HP left wins (`turnCap`;
 * a tie goes to Red).
 */
export function simulateBattle(
  red: BattleTeam,
  blue: BattleTeam,
  seed: number,
  opts: { turnCap?: number } = {},
): { events: BattleEvent[]; result: BattleResult } {
  assertTeamSizes(red, blue);
  const turnCap = opts.turnCap ?? DEFAULT_TURN_CAP;
  const rng = createRng(seed);
  const events: BattleEvent[] = [];
  const sides: Record<Side, SideState> = {
    red: { team: red, active: 0, entered: false },
    blue: { team: blue, active: 0, entered: false },
  };
  const hp = new Map<string, number>();
  const stats = new Map<string, FighterSummary>();
  for (const f of [...red.fighters, ...blue.fighters]) {
    hp.set(f.id, f.stats.hp);
    stats.set(f.id, { fighterId: f.id, kos: 0, damageDealt: 0, damageTaken: 0, survived: true });
  }
  /** Fighters that have already been active for a whole turn (their first strike is spent). */
  const seasoned = new Set<string>();

  const activeOf = (s: Side): Fighter => {
    const fighter = sides[s].team.fighters[sides[s].active];
    if (!fighter) throw new Error(`Team ${s} has no active fighter`);
    return fighter;
  };
  const other = (s: Side): Side => (s === 'red' ? 'blue' : 'red');
  const enterIfNeeded = (turn: number) => {
    for (const s of ['red', 'blue'] as const) {
      if (!sides[s].entered) {
        sides[s].entered = true;
        events.push({ kind: 'enter', turn, fighterId: activeOf(s).id });
      }
    }
  };

  /** Performs one action; returns true if the target's side has no fighters left. */
  const act = (turn: number, attacker: Fighter, defender: Fighter): boolean => {
    const ids = { attackerId: attacker.id, targetId: defender.id };
    const move = chooseMove(attacker, defender, rng);
    events.push({ kind: 'move', turn, ...ids, move });
    if (move.accuracy !== null && rng() * 100 >= move.accuracy) {
      events.push({ kind: 'miss', turn, ...ids });
      return false;
    }
    const result = calcDamage(attacker, defender, move, rng);
    if (result.effectiveness === 0) {
      events.push({ kind: 'noEffect', turn, ...ids });
      return false;
    }
    const hpBefore = hp.get(defender.id) ?? 0;
    const damage = Math.min(result.damage, hpBefore);
    const hpAfter = hpBefore - damage;
    hp.set(defender.id, hpAfter);
    events.push({
      kind: 'hit',
      turn,
      ...ids,
      damage,
      effectiveness: result.effectiveness,
      critical: result.critical,
      hpBefore,
      hpAfter,
    });
    const dealer = stats.get(attacker.id);
    const taker = stats.get(defender.id);
    if (dealer) dealer.damageDealt += damage;
    if (taker) taker.damageTaken += damage;
    if (hpAfter > 0) return false;

    events.push({ kind: 'ko', turn, fighterId: defender.id });
    if (dealer) dealer.kos += 1;
    if (taker) taker.survived = false;
    const state = sides[defender.side];
    if (state.active + 1 >= state.team.fighters.length) return true;
    state.active += 1;
    state.entered = false;
    return false;
  };

  const dealtBy = (team: BattleTeam) =>
    team.fighters.reduce((n, f) => n + (stats.get(f.id)?.damageDealt ?? 0), 0);

  const finish = (turn: number, winner: Side, reason: BattleEndReason) => {
    const summary = [...stats.values()];
    events.push({ kind: 'end', turn, winner, reason, summary });
    const result: BattleResult = {
      winner,
      reason,
      turns: turn,
      redDamageDealt: dealtBy(red),
      blueDamageDealt: dealtBy(blue),
      fighters: summary.map((s) => ({ ...s })),
    };
    return { events, result };
  };

  const hpFraction = (s: Side) => {
    const fighters = sides[s].team.fighters;
    const max = fighters.reduce((n, f) => n + f.stats.hp, 0);
    return fighters.reduce((n, f) => n + (hp.get(f.id) ?? 0), 0) / max;
  };

  /** Red acts first this turn? First strike (fresh on the field) beats speed; otherwise speed, a tie flips a coin. */
  const redActsFirst = (r: Fighter, b: Fighter): boolean => {
    const redStrikes = r.firstStrike === true && !seasoned.has(r.id);
    const blueStrikes = b.firstStrike === true && !seasoned.has(b.id);
    if (redStrikes !== blueStrikes) return redStrikes;
    const redSpeed = r.stats.speed;
    const blueSpeed = b.stats.speed;
    return redSpeed === blueSpeed ? rng() < 0.5 : redSpeed > blueSpeed;
  };

  enterIfNeeded(0);
  for (let turn = 1; turn <= turnCap; turn++) {
    events.push({ kind: 'turnStart', turn });
    enterIfNeeded(turn);
    // Fighters are fixed for the turn: a replacement sent in by a KO only enters next turn.
    const fighters: Record<Side, Fighter> = { red: activeOf('red'), blue: activeOf('blue') };
    const order: Side[] = redActsFirst(fighters.red, fighters.blue)
      ? ['red', 'blue']
      : ['blue', 'red'];
    for (const s of order) {
      const attacker = fighters[s];
      const defender = fighters[other(s)];
      // A fighter KO'd earlier this turn does not act.
      if ((hp.get(attacker.id) ?? 0) <= 0 || (hp.get(defender.id) ?? 0) <= 0) continue;
      if (act(turn, attacker, defender)) return finish(turn, s, 'knockout');
    }
    seasoned.add(fighters.red.id);
    seasoned.add(fighters.blue.id);
  }
  const winner: Side = hpFraction('blue') > hpFraction('red') ? 'blue' : 'red';
  return finish(turnCap, winner, 'turnCap');
}
