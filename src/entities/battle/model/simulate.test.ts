import { describe, expect, it } from 'vitest';
import { calcDamage, chooseMove, FALLBACK_MOVE } from './damage';
import type { BattleEvent } from './events';
import { createRng } from './rng';
import { simulateBattle } from './simulate';
import type { BattleTeam, Move } from './types';
import { makeFighter, makeTeam, SHADOW_BALL, TACKLE } from './testFighters';

const EMBER: Move = { name: 'ember', type: 'fire', power: 40, accuracy: 100, damageClass: 'special' };

function sampleTeams(): [BattleTeam, BattleTeam] {
  return [makeTeam('red', ['normal'], [TACKLE], 110), makeTeam('blue', ['normal'], [TACKLE], 90)];
}

describe('simulateBattle', () => {
  it('is fully deterministic for the same teams and seed', () => {
    const [r, b] = sampleTeams();
    expect(simulateBattle(r, b, 7)).toEqual(simulateBattle(r, b, 7));
    expect(simulateBattle(r, b, 7).events).not.toEqual(simulateBattle(r, b, 8).events);
  });

  it('produces a well-formed relay: starts with two enters, ends with one end event', () => {
    const { events, winner } = simulateBattle(...sampleTeams(), 1);
    expect(events.slice(0, 2).map((e) => e.kind)).toEqual(['enter', 'enter']);
    expect(events.at(-1)).toMatchObject({ kind: 'end', winner, reason: 'knockout' });
    expect(events.filter((e) => e.kind === 'end')).toHaveLength(1);
    const loser = winner === 'red' ? 'blue' : 'red';
    expect(events.filter((e) => e.kind === 'ko' && e.fighterId.startsWith(loser))).toHaveLength(4);
  });

  it('sends the next fighter with enter right after the next turnStart', () => {
    const { events } = simulateBattle(...sampleTeams(), 1);
    const kos = events.map((e, i) => [e, i] as const).filter(([e]) => e.kind === 'ko').slice(0, -1);
    for (const [, i] of kos) {
      const next = events.slice(i + 1).find((e) => e.kind === 'turnStart' || e.kind === 'enter');
      expect(next?.kind).toBe('turnStart');
    }
    // every KO except the last one is followed by exactly one replacement entering
    expect(events.filter((e) => e.kind === 'enter')).toHaveLength(2 + (events.filter((e) => e.kind === 'ko').length - 1));
  });

  it('hit events keep hp consistent and never below 0', () => {
    for (const e of simulateBattle(...sampleTeams(), 3).events)
      if (e.kind === 'hit') {
        expect(e.hpAfter).toBe(Math.max(0, e.hpBefore - e.damage));
        expect(e.hpAfter).toBeGreaterThanOrEqual(0);
      }
  });

  it('immunity yields noEffect, not damage', () => {
    const { events } = simulateBattle(
      makeTeam('red', ['normal'], [TACKLE]), makeTeam('blue', ['ghost'], [EMBER], 50), 4, { turnCap: 3 });
    const redMoves = events.filter((e) => e.kind === 'move' && e.attackerId.startsWith('red'));
    const redResults = events.filter((e) => 'attackerId' in e && e.attackerId.startsWith('red') && e.kind !== 'move');
    expect(redMoves.length).toBe(3);
    expect(redResults.every((e) => e.kind === 'noEffect')).toBe(true);
  });

  it('ends a mutual-immunity stalemate at the turn cap by remaining HP %', () => {
    const { events, winner } = simulateBattle(
      makeTeam('red', ['normal'], [TACKLE]), makeTeam('blue', ['ghost'], [SHADOW_BALL]), 5, { turnCap: 10 });
    expect(events.at(-1)).toMatchObject({ kind: 'end', reason: 'turnCap' });
    expect(events.filter((e) => e.kind === 'turnStart')).toHaveLength(10);
    expect(winner).toBe('red'); // equal HP % -> red
  });

  it('awards the cap win to the side with more remaining HP %', () => {
    const red = makeTeam('red', ['normal'], [TACKLE], 100);
    const blue = makeTeam('blue', ['normal'], [TACKLE], 90);
    const { events, winner } = simulateBattle(red, blue, 9, { turnCap: 2 });
    expect(events.at(-1)).toMatchObject({ kind: 'end', reason: 'turnCap' });
    const dmg = (side: string) => events
      .filter((e): e is Extract<BattleEvent, { kind: 'hit' }> => e.kind === 'hit' && e.targetId.startsWith(side))
      .reduce((n, e) => n + e.damage, 0);
    expect(winner).toBe(dmg('blue') >= dmg('red') ? 'red' : 'blue');
  });

  it('keeps same-species fighters distinct by side and slot', () => {
    const [r, b] = [makeTeam('red', ['electric'], [TACKLE]), makeTeam('blue', ['electric'], [TACKLE])];
    const ids = new Set(simulateBattle(r, b, 2).events
      .flatMap((e) => ('fighterId' in e ? [e.fighterId] : 'attackerId' in e ? [e.attackerId, e.targetId] : [])));
    expect([...ids].every((id) => /^(red|blue)-[0-3]$/.test(id))).toBe(true);
    expect(ids.size).toBeGreaterThan(2);
  });

  it('summary totals equal the hit events', () => {
    const { events } = simulateBattle(...sampleTeams(), 11);
    const hits = events.filter((e): e is Extract<BattleEvent, { kind: 'hit' }> => e.kind === 'hit');
    const end = events.at(-1);
    if (end?.kind !== 'end') throw new Error('no end');
    const total = hits.reduce((n, h) => n + h.damage, 0);
    expect(end.summary.reduce((n, s) => n + s.damageDealt, 0)).toBe(total);
    expect(end.summary.reduce((n, s) => n + s.damageTaken, 0)).toBe(total);
    expect(end.summary.reduce((n, s) => n + s.kos, 0)).toBe(events.filter((e) => e.kind === 'ko').length);
    expect(end.summary).toHaveLength(8);
  });

  it('a null-accuracy move never misses', () => {
    const sure: Move = { ...TACKLE, accuracy: null };
    const { events } = simulateBattle(makeTeam('red', ['normal'], [sure]), makeTeam('blue', ['normal'], [sure]), 6);
    expect(events.some((e) => e.kind === 'miss')).toBe(false);
  });
});

describe('KO ordering', () => {
  function glassTeams(): [BattleTeam, BattleTeam] {
    const red = makeTeam('red', ['normal'], [TACKLE], 100);
    const blue = makeTeam('blue', ['normal'], [TACKLE], 50);
    red.fighters.forEach((f) => { f.stats = { ...f.stats, attack: 500, hp: 500 }; });
    blue.fighters.forEach((f) => { f.stats = { ...f.stats, hp: 5 }; });
    return [red, blue];
  }

  it('a KO-ed second attacker never acts, and a replacement is silent until it enters', () => {
    const { events } = simulateBattle(...glassTeams(), 3);
    expect(events.some((e) => e.kind === 'move' && e.attackerId.startsWith('blue'))).toBe(false);
    expect(events.filter((e) => e.kind === 'ko')).toHaveLength(4);
  });

  it('no event involves a fighter between its predecessor KO and its own enter', () => {
    for (const seed of [1, 2, 3]) {
      for (const teams of [sampleTeams(), glassTeams()]) {
        const { events } = simulateBattle(...teams, seed);
        const entered = new Set<string>();
        for (const e of events) {
          if (e.kind === 'enter') entered.add(e.fighterId);
          else if (e.kind === 'move' || e.kind === 'miss' || e.kind === 'noEffect' || e.kind === 'hit') {
            expect(entered.has(e.attackerId)).toBe(true);
            expect(entered.has(e.targetId)).toBe(true);
          }
        }
      }
    }
  });
});

describe('calcDamage', () => {
  it('matches the formula for a fixed roll', () => {
    // base = floor(floor(22*40*75/60)/50)+2 = 24; STAB none (fire vs normal user); x1 eff
    const rolls = [0.99, 0.0];
    const rng = () => rolls.shift() ?? 0;
    const atk = makeFighter({ types: ['fire'] });
    expect(calcDamage(atk, makeFighter({ side: 'blue' }), TACKLE, rng))
      .toEqual({ damage: 20, effectiveness: 1, critical: false }); // floor(24 * 0.85)
  });

  it('applies STAB, effectiveness and crit', () => {
    const rolls = [0.0, 0.99999999];
    const rng = () => rolls.shift() ?? 0;
    const atk = makeFighter(); // normal-type using tackle: STAB
    const res = calcDamage(atk, makeFighter({ side: 'blue' }), TACKLE, rng);
    expect(res.critical).toBe(true);
    expect(res.damage).toBe(Math.floor(24 * 1.5 * 1.5 * (0.85 + 0.15 * 0.99999999)));
  });

  it('returns 0 damage and consumes no rng on immunity', () => {
    let calls = 0;
    const res = calcDamage(makeFighter(), makeFighter({ types: ['ghost'] }), TACKLE, () => (calls++, 0.5));
    expect(res).toEqual({ damage: 0, effectiveness: 0, critical: false });
    expect(calls).toBe(0);
  });
});

describe('chooseMove', () => {
  it('a fighter with no moves uses the fallback strike', () => {
    const moveless = makeFighter({ moves: [] });
    expect(chooseMove(moveless, makeFighter(), createRng(1))).toBe(FALLBACK_MOVE);
  });

  it('excludes zero-weight moves unless all are zero', () => {
    const atk = makeFighter({ moves: [TACKLE, EMBER] });
    const ghost = makeFighter({ side: 'blue', types: ['ghost'] });
    for (let s = 0; s < 20; s++) expect(chooseMove(atk, ghost, createRng(s))).toBe(EMBER);
    const onlyTackle = makeFighter({ moves: [TACKLE] });
    expect(chooseMove(onlyTackle, ghost, createRng(1))).toBe(TACKLE);
  });
});
