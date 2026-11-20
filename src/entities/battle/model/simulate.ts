import { calcDamage, chooseMove } from './damage';
import type { BattleEvent, FighterSummary } from './events';
import { createRng } from './rng';
import type { BattleTeam, Fighter, Side } from './types';

const DEFAULT_TURN_CAP = 40;

type SideState = { team: BattleTeam; active: number; entered: boolean };

export function simulateBattle(
  red: BattleTeam, blue: BattleTeam, seed: number, opts: { turnCap?: number } = {},
): { events: BattleEvent[]; winner: Side } {
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
      kind: 'hit', turn, ...ids, damage,
      effectiveness: result.effectiveness, critical: result.critical, hpBefore, hpAfter,
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

  const finish = (turn: number, winner: Side, reason: 'knockout' | 'turnCap') => {
    events.push({ kind: 'end', turn, winner, reason, summary: [...stats.values()] });
    return { events, winner };
  };

  const hpFraction = (s: Side) => {
    const fighters = sides[s].team.fighters;
    const max = fighters.reduce((n, f) => n + f.stats.hp, 0);
    return fighters.reduce((n, f) => n + (hp.get(f.id) ?? 0), 0) / max;
  };

  enterIfNeeded(0);
  for (let turn = 1; turn <= turnCap; turn++) {
    events.push({ kind: 'turnStart', turn });
    enterIfNeeded(turn);
    const redSpeed = activeOf('red').stats.speed;
    const blueSpeed = activeOf('blue').stats.speed;
    const redFirst = redSpeed === blueSpeed ? rng() < 0.5 : redSpeed > blueSpeed;
    const order: Side[] = redFirst ? ['red', 'blue'] : ['blue', 'red'];
    for (const s of order) {
      const attacker = activeOf(s);
      const defender = activeOf(other(s));
      // A fighter KO'd earlier this turn does not act (active index may have advanced).
      if ((hp.get(attacker.id) ?? 0) <= 0 || (hp.get(defender.id) ?? 0) <= 0) continue;
      if (act(turn, attacker, defender)) return finish(turn, s, 'knockout');
    }
  }
  const winner: Side = hpFraction('blue') > hpFraction('red') ? 'blue' : 'red';
  return finish(turnCap, winner, 'turnCap');
}
