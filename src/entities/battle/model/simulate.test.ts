import { describe, expect, it } from 'vitest';
import { calcDamage, chooseMove, critChance, FALLBACK_MOVE } from './damage';
import type { BattleEvent } from './events';
import { createRng } from './rng';
import { simulateBattle, TeamSizeError } from './simulate';
import type { BattleTeam, Move } from './types';
import { makeFighter, makeTeam, SHADOW_BALL, TACKLE } from './testFighters';

const EMBER: Move = {
  name: 'ember',
  type: 'fire',
  power: 40,
  accuracy: 100,
  damageClass: 'special',
};

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
    const {
      events,
      result: { winner },
    } = simulateBattle(...sampleTeams(), 1);
    expect(events.slice(0, 2).map((e) => e.kind)).toEqual(['enter', 'enter']);
    expect(events.at(-1)).toMatchObject({ kind: 'end', winner, reason: 'knockout' });
    expect(events.filter((e) => e.kind === 'end')).toHaveLength(1);
    const loser = winner === 'red' ? 'blue' : 'red';
    expect(events.filter((e) => e.kind === 'ko' && e.fighterId.startsWith(loser))).toHaveLength(4);
  });

  it('sends the next fighter with enter right after the next turnStart', () => {
    const { events } = simulateBattle(...sampleTeams(), 1);
    const kos = events
      .map((e, i) => [e, i] as const)
      .filter(([e]) => e.kind === 'ko')
      .slice(0, -1);
    for (const [, i] of kos) {
      const next = events.slice(i + 1).find((e) => e.kind === 'turnStart' || e.kind === 'enter');
      expect(next?.kind).toBe('turnStart');
    }
    // every KO except the last one is followed by exactly one replacement entering
    expect(events.filter((e) => e.kind === 'enter')).toHaveLength(
      2 + (events.filter((e) => e.kind === 'ko').length - 1),
    );
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
      makeTeam('red', ['normal'], [TACKLE]),
      makeTeam('blue', ['ghost'], [EMBER], 50),
      4,
      { turnCap: 3 },
    );
    const redMoves = events.filter((e) => e.kind === 'move' && e.attackerId.startsWith('red'));
    const redResults = events.filter(
      (e) => 'attackerId' in e && e.attackerId.startsWith('red') && e.kind !== 'move',
    );
    expect(redMoves.length).toBe(3);
    expect(redResults.every((e) => e.kind === 'noEffect')).toBe(true);
  });

  it('ends a mutual-immunity stalemate at the turn cap by remaining HP %', () => {
    const {
      events,
      result: { winner },
    } = simulateBattle(
      makeTeam('red', ['normal'], [TACKLE]),
      makeTeam('blue', ['ghost'], [SHADOW_BALL]),
      5,
      { turnCap: 10 },
    );
    expect(events.at(-1)).toMatchObject({ kind: 'end', reason: 'turnCap' });
    expect(events.filter((e) => e.kind === 'turnStart')).toHaveLength(10);
    expect(winner).toBe('red'); // equal HP % -> red
  });

  it('awards the cap win to the side with more remaining HP %', () => {
    const red = makeTeam('red', ['normal'], [TACKLE], 100);
    const blue = makeTeam('blue', ['normal'], [TACKLE], 90);
    const {
      events,
      result: { winner },
    } = simulateBattle(red, blue, 9, { turnCap: 2 });
    expect(events.at(-1)).toMatchObject({ kind: 'end', reason: 'turnCap' });
    const dmg = (side: string) =>
      events
        .filter(
          (e): e is Extract<BattleEvent, { kind: 'hit' }> =>
            e.kind === 'hit' && e.targetId.startsWith(side),
        )
        .reduce((n, e) => n + e.damage, 0);
    expect(winner).toBe(dmg('blue') >= dmg('red') ? 'red' : 'blue');
  });

  it('keeps same-species fighters distinct by side and slot', () => {
    const [r, b] = [
      makeTeam('red', ['electric'], [TACKLE]),
      makeTeam('blue', ['electric'], [TACKLE]),
    ];
    const ids = new Set(
      simulateBattle(r, b, 2).events.flatMap((e) =>
        'fighterId' in e ? [e.fighterId] : 'attackerId' in e ? [e.attackerId, e.targetId] : [],
      ),
    );
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
    expect(end.summary.reduce((n, s) => n + s.kos, 0)).toBe(
      events.filter((e) => e.kind === 'ko').length,
    );
    expect(end.summary).toHaveLength(8);
  });

  it('a null-accuracy move never misses', () => {
    const sure: Move = { ...TACKLE, accuracy: null };
    const { events } = simulateBattle(
      makeTeam('red', ['normal'], [sure]),
      makeTeam('blue', ['normal'], [sure]),
      6,
    );
    expect(events.some((e) => e.kind === 'miss')).toBe(false);
  });
});

describe('KO ordering', () => {
  function glassTeams(): [BattleTeam, BattleTeam] {
    const red = makeTeam('red', ['normal'], [TACKLE], 100);
    const blue = makeTeam('blue', ['normal'], [TACKLE], 50);
    red.fighters.forEach((f) => {
      f.stats = { ...f.stats, attack: 500, hp: 500 };
    });
    blue.fighters.forEach((f) => {
      f.stats = { ...f.stats, hp: 5 };
    });
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
          else if (
            e.kind === 'move' ||
            e.kind === 'miss' ||
            e.kind === 'noEffect' ||
            e.kind === 'hit'
          ) {
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
    expect(calcDamage(atk, makeFighter({ side: 'blue' }), TACKLE, rng)).toEqual({
      damage: 20,
      effectiveness: 1,
      critical: false,
    }); // floor(24 * 0.85)
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
    const res = calcDamage(
      makeFighter(),
      makeFighter({ types: ['ghost'] }),
      TACKLE,
      () => (calls++, 0.5),
    );
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

describe('N×N teams', () => {
  const teams = (n: number): [BattleTeam, BattleTeam] => [
    makeTeam('red', ['normal'], [TACKLE], 100, n),
    makeTeam('blue', ['normal'], [TACKLE], 95, n),
  ];

  it.each([1, 2, 3, 4])('plays %i×%i deterministically to a knockout', (n) => {
    const [r, b] = teams(n);
    const first = simulateBattle(r, b, 42);
    expect(simulateBattle(r, b, 42)).toEqual(first);
    const { events, result } = first;
    expect(events.filter((e) => e.kind === 'enter').length).toBe(
      2 + events.filter((e) => e.kind === 'ko').length - 1,
    );
    const loser = result.winner === 'red' ? 'blue' : 'red';
    expect(events.filter((e) => e.kind === 'ko' && e.fighterId.startsWith(loser))).toHaveLength(n);
    expect(result.reason).toBe('knockout');
    expect(result.fighters.map((f) => f.fighterId)).toEqual([
      ...r.fighters.map((f) => f.id),
      ...b.fighters.map((f) => f.id),
    ]);
  });

  it.each([
    ['unequal', 2, 3, /same size \(red 2, blue 3\)/],
    ['empty', 0, 0, /1–4 fighters, red has 0/],
    ['more than four', 5, 5, /1–4 fighters, red has 5/],
  ])('rejects %s teams with a clear error', (_, redSize, blueSize, message) => {
    const red = makeTeam('red', ['normal'], [TACKLE], 100, redSize);
    const blue = makeTeam('blue', ['normal'], [TACKLE], 100, blueSize);
    expect(() => simulateBattle(red, blue, 1)).toThrow(TeamSizeError);
    expect(() => simulateBattle(red, blue, 1)).toThrow(message);
  });

  it('rejects an empty blue team even when red is valid', () => {
    expect(() =>
      simulateBattle(
        makeTeam('red', ['normal'], [TACKLE], 100, 1),
        makeTeam('blue', ['normal'], [TACKLE], 100, 0),
        1,
      ),
    ).toThrow(/blue has 0/);
  });
});

describe('battle result', () => {
  it('reports winner, reason and turns matching the end event', () => {
    for (const n of [1, 2, 3, 4]) {
      const { events, result } = simulateBattle(
        makeTeam('red', ['normal'], [TACKLE], 100, n),
        makeTeam('blue', ['normal'], [TACKLE], 90, n),
        n * 7,
      );
      const end = events.at(-1);
      if (end?.kind !== 'end') throw new Error('no end');
      expect(result).toMatchObject({ winner: end.winner, reason: end.reason, turns: end.turn });
      expect(result.turns).toBe(events.filter((e) => e.kind === 'turnStart').length);
    }
  });

  it('red total = sum of red fighters’ damageDealt = sum of hit damage by red', () => {
    for (const n of [1, 2, 3, 4]) {
      for (const seed of [1, 2, 3]) {
        const { events, result } = simulateBattle(
          makeTeam('red', ['fire'], [EMBER, TACKLE], 100, n),
          makeTeam('blue', ['grass'], [TACKLE], 105, n),
          seed,
        );
        const hitsBy = (side: string) =>
          events
            .filter(
              (e): e is Extract<BattleEvent, { kind: 'hit' }> =>
                e.kind === 'hit' && e.attackerId.startsWith(side),
            )
            .reduce((sum, e) => sum + e.damage, 0);
        const dealtBy = (side: string) =>
          result.fighters
            .filter((f) => f.fighterId.startsWith(side))
            .reduce((sum, f) => sum + f.damageDealt, 0);
        expect(result.redDamageDealt).toBe(dealtBy('red'));
        expect(result.redDamageDealt).toBe(hitsBy('red'));
        expect(result.blueDamageDealt).toBe(dealtBy('blue'));
        expect(result.blueDamageDealt).toBe(hitsBy('blue'));
        expect(result.redDamageDealt).toBeGreaterThan(0);
      }
    }
  });

  it('a turn-cap result reports the cap as its turn count', () => {
    const { result } = simulateBattle(
      makeTeam('red', ['normal'], [TACKLE], 100, 2),
      makeTeam('blue', ['ghost'], [SHADOW_BALL], 100, 2),
      5,
      { turnCap: 6 },
    );
    expect(result).toMatchObject({ reason: 'turnCap', turns: 6, redDamageDealt: 0 });
  });

  it('result fighters are copies: mutating them leaves the end event alone', () => {
    const { events, result } = simulateBattle(...sampleTeams(), 4);
    const first = result.fighters[0];
    if (!first) throw new Error('no fighters');
    first.damageDealt = -1;
    const end = events.at(-1);
    expect(end?.kind === 'end' && end.summary[0]?.damageDealt).not.toBe(-1);
  });
});

describe('talent modifiers', () => {
  const critRate = (bonus: number | undefined) => {
    const attacker = makeFighter(bonus === undefined ? {} : { critChanceBonus: bonus });
    const defender = makeFighter({ side: 'blue' });
    const rng = createRng(99);
    let crits = 0;
    for (let i = 0; i < 4000; i++)
      if (calcDamage(attacker, defender, TACKLE, rng).critical) crits++;
    return crits / 4000;
  };

  it('critChance is the base 1/24 without a bonus and adds percentage points with one', () => {
    expect(critChance(makeFighter())).toBe(1 / 24);
    expect(critChance(makeFighter({ critChanceBonus: 10 }))).toBeCloseTo(1 / 24 + 0.1);
    expect(critChance(makeFighter({ critChanceBonus: 500 }))).toBe(1);
    expect(critChance(makeFighter({ critChanceBonus: -500 }))).toBe(0);
  });

  it('critChanceBonus raises the crit rate', () => {
    const base = critRate(undefined);
    const boosted = critRate(20);
    expect(base).toBeGreaterThan(0.02);
    expect(base).toBeLessThan(0.07);
    expect(boosted).toBeGreaterThan(0.2);
    expect(boosted).toBeLessThan(0.3);
  });

  it('a zero bonus behaves exactly like no bonus', () => {
    const [r, b] = sampleTeams();
    const zero = { ...r, fighters: r.fighters.map((f) => ({ ...f, critChanceBonus: 0 })) };
    expect(simulateBattle(zero, b, 13)).toEqual(simulateBattle(r, b, 13));
  });

  const firstAttacker = (events: BattleEvent[], turn: number) =>
    events.find((e) => e.kind === 'move' && e.turn === turn);

  it('firstStrike makes a slower fighter act first in its first turn only', () => {
    const slow = makeFighter({ firstStrike: true, stats: { ...makeFighter().stats, speed: 10 } });
    const fast = makeFighter({ side: 'blue', stats: { ...makeFighter().stats, speed: 200 } });
    const red: BattleTeam = { side: 'red', trainerName: 'r', fighters: [slow] };
    const blue: BattleTeam = { side: 'blue', trainerName: 'b', fighters: [fast] };
    const { events } = simulateBattle(red, blue, 3);
    expect(firstAttacker(events, 1)).toMatchObject({ attackerId: 'red-0' });
    expect(firstAttacker(events, 2)).toMatchObject({ attackerId: 'blue-0' });
  });

  it('firstStrike applies again to a replacement in its first turn on the field', () => {
    const red = makeTeam('red', ['normal'], [TACKLE], 10, 2);
    red.fighters.forEach((f) => (f.firstStrike = true));
    const blue = makeTeam('blue', ['normal'], [TACKLE], 200, 2);
    blue.fighters.forEach((f) => (f.stats = { ...f.stats, attack: 400 }));
    const { events } = simulateBattle(red, blue, 8);
    const entry = events.find((e) => e.kind === 'enter' && e.fighterId === 'red-1');
    if (!entry) throw new Error('red-1 never entered');
    expect(firstAttacker(events, entry.turn)).toMatchObject({ attackerId: 'red-1' });
  });

  it('when both actives have firstStrike the speed order decides', () => {
    const red = makeTeam('red', ['normal'], [TACKLE], 10, 1);
    const blue = makeTeam('blue', ['normal'], [TACKLE], 200, 1);
    for (const f of [...red.fighters, ...blue.fighters]) f.firstStrike = true;
    expect(firstAttacker(simulateBattle(red, blue, 3).events, 1)).toMatchObject({
      attackerId: 'blue-0',
    });
  });

  it('firstStrike: false behaves exactly like no modifier', () => {
    const [r, b] = sampleTeams();
    const off = { ...r, fighters: r.fighters.map((f) => ({ ...f, firstStrike: false })) };
    expect(simulateBattle(off, b, 21)).toEqual(simulateBattle(r, b, 21));
  });
});

describe('levels', () => {
  it('damage scales with the attacker’s level (level 50 keeps the old formula)', () => {
    const roll = () => 0.5;
    const at = (level: number) =>
      calcDamage(makeFighter({ level }), makeFighter({ side: 'blue' }), TACKLE, roll).damage;
    expect(at(5)).toBeLessThan(at(20));
    expect(at(20)).toBeLessThan(at(50));
  });
});
