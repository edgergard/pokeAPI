import { describe, expect, it } from 'vitest';
import type { BattleEvent, BattleTeam, Fighter, Move } from '@/entities/battle';
import { describeEvent, initialHud, reduceHud } from './hudState';

const FLAMETHROWER: Move = { name: 'flamethrower', type: 'fire', power: 90, accuracy: 100, damageClass: 'special' };

const fighter = (side: 'red' | 'blue', slot: number, name: string, hp = 110): Fighter => ({
  id: `${side}-${slot}`,
  side,
  slot,
  name,
  pokemonId: 1,
  types: ['normal'],
  artwork: null,
  stats: { hp, attack: 70, defense: 70, specialAttack: 70, specialDefense: 70, speed: 70 },
  moves: [FLAMETHROWER],
});

const red: BattleTeam = {
  side: 'red',
  trainerName: 'Ash',
  fighters: [fighter('red', 0, 'pikachu'), fighter('red', 1, 'mr-mime', 120)],
};
const blue: BattleTeam = {
  side: 'blue',
  trainerName: 'Mira',
  fighters: [fighter('blue', 0, 'charizard'), fighter('blue', 1, 'gengar')],
};

const fighters: Record<string, Fighter> = Object.fromEntries(
  [...red.fighters, ...blue.fighters].map((f) => [f.id, f]),
);

type HitEvent = Extract<BattleEvent, { kind: 'hit' }>;
const hit = (over: Partial<HitEvent> = {}): HitEvent => ({
  kind: 'hit', turn: 1, attackerId: 'blue-0', targetId: 'red-0', damage: 30,
  effectiveness: 1, critical: false, hpBefore: 110, hpAfter: 80, ...over,
});

const moveEvt: BattleEvent = { kind: 'move', turn: 1, attackerId: 'blue-0', targetId: 'red-0', move: FLAMETHROWER };
const hitEvt = hit({ effectiveness: 2, damage: 98, hpAfter: 12 });
const noEffectEvt: BattleEvent = { kind: 'noEffect', turn: 2, attackerId: 'red-0', targetId: 'blue-1' };

describe('initialHud', () => {
  it('starts every fighter at full HP with nobody active, no KOs and no result', () => {
    const s = initialHud(red, blue);
    expect(s.hp['red-1']).toEqual({ current: 120, max: 120 });
    expect(s.hp['blue-0']).toEqual({ current: 110, max: 110 });
    expect(s.active).toEqual({ red: null, blue: null });
    expect(s.ko.size).toBe(0);
    expect(s.lastMove).toBeNull();
    expect(s.popups).toEqual([]);
    expect(s.result).toBeNull();
  });
});

describe('reduceHud', () => {
  it('reduceHud applies hits, KOs, entries and the result', () => {
    let s = initialHud(red, blue);
    s = reduceHud(s, { kind: 'enter', turn: 0, fighterId: 'red-0' });
    expect(s.active.red).toBe('red-0');
    s = reduceHud(s, { kind: 'hit', turn: 1, attackerId: 'blue-0', targetId: 'red-0', damage: 30, effectiveness: 2, critical: false, hpBefore: 110, hpAfter: 80 });
    expect(s.hp['red-0']?.current).toBe(80);
    expect(s.popups.at(-1)).toMatchObject({ fighterId: 'red-0', tone: 'super' });
    s = reduceHud(s, { kind: 'ko', turn: 3, fighterId: 'red-0' });
    expect(s.ko.has('red-0')).toBe(true);
    const summary = [{ fighterId: 'blue-0', kos: 1, damageDealt: 110, damageTaken: 0, survived: true }];
    s = reduceHud(s, { kind: 'end', turn: 3, winner: 'blue', reason: 'knockout', summary });
    expect(s.result).toEqual({ winner: 'blue', reason: 'knockout', summary });
  });

  it('is pure: the previous state is untouched', () => {
    const before = initialHud(red, blue);
    const after = reduceHud(reduceHud(before, hit()), { kind: 'ko', turn: 1, fighterId: 'red-0' });
    expect(before.hp['red-0']?.current).toBe(110);
    expect(before.ko.size).toBe(0);
    expect(before.popups).toHaveLength(0);
    expect(after.ko.has('red-0')).toBe(true);
  });

  it('records the move banner with a readable name', () => {
    const s = reduceHud(initialHud(red, blue), moveEvt);
    expect(s.lastMove).toEqual({ attackerId: 'blue-0', name: 'Flamethrower' });
  });

  it('picks a popup tone per result, with unique ids', () => {
    let s = initialHud(red, blue);
    s = reduceHud(s, hit());
    s = reduceHud(s, hit({ critical: true }));
    s = reduceHud(s, hit({ effectiveness: 0.5 }));
    s = reduceHud(s, { kind: 'miss', turn: 1, attackerId: 'blue-0', targetId: 'red-0' });
    s = reduceHud(s, { kind: 'noEffect', turn: 1, attackerId: 'blue-0', targetId: 'red-0' });
    expect(s.popups.map((p) => p.tone)).toEqual(['damage', 'crit', 'weak', 'miss', 'immune']);
    expect(s.popups[0]?.text).toBe('−30');
    expect(new Set(s.popups.map((p) => p.id)).size).toBe(5);
  });

  it('keeps only the most recent popups', () => {
    let s = initialHud(red, blue);
    for (let i = 0; i < 20; i += 1) s = reduceHud(s, hit());
    expect(s.popups.length).toBeLessThanOrEqual(6);
    expect(s.popups.at(-1)?.id).toBeGreaterThan(s.popups[0]?.id ?? Infinity);
  });

  it('ignores events that change nothing it shows', () => {
    const s = initialHud(red, blue);
    expect(reduceHud(s, { kind: 'turnStart', turn: 4 })).toBe(s);
  });
});

describe('describeEvent', () => {
  it('describeEvent writes readable log lines', () => {
    expect(describeEvent(moveEvt, fighters)).toBe('Charizard used Flamethrower!');
    expect(describeEvent({ ...hitEvt, targetId: 'red-0' }, fighters)).toBe('Super effective! Pikachu has 12 HP left.');
    expect(describeEvent(noEffectEvt, fighters)).toBe('It doesn’t affect Gengar…');
  });

  it('covers the other result kinds', () => {
    expect(describeEvent(hit(), fighters)).toBe('Pikachu has 80 HP left.');
    expect(describeEvent(hit({ hpAfter: 0 }), fighters)).toBe('Pikachu has no HP left.');
    expect(describeEvent(hit({ effectiveness: 0.5 }), fighters)).toBe('Not very effective… Pikachu has 80 HP left.');
    expect(describeEvent(hit({ critical: true, effectiveness: 2 }), fighters))
      .toBe('A critical hit! Super effective! Pikachu has 80 HP left.');
    expect(describeEvent({ kind: 'miss', turn: 1, attackerId: 'blue-0', targetId: 'red-0' }, fighters))
      .toBe('Pikachu dodged Charizard’s attack!');
    expect(describeEvent({ kind: 'ko', turn: 1, fighterId: 'red-1' }, fighters)).toBe('Mr Mime is knocked out!');
    expect(describeEvent({ kind: 'enter', turn: 0, fighterId: 'blue-1' }, fighters)).toBe('Gengar steps into the arena.');
    expect(describeEvent({ kind: 'turnStart', turn: 2 }, fighters)).toBeNull();
  });

  describe('same species on both sides', () => {
    const mirror: Record<string, Fighter> = {
      ...fighters,
      'red-0': fighter('red', 0, 'charizard'),
    };
    const trainers = { red: 'Ash', blue: 'Mira' };

    it('names each fighter with its trainer', () => {
      expect(describeEvent(moveEvt, mirror, trainers)).toBe('Mira’s Charizard used Flamethrower!');
      expect(describeEvent(hit(), mirror, trainers)).toBe('Ash’s Charizard has 80 HP left.');
      expect(describeEvent({ kind: 'miss', turn: 1, attackerId: 'blue-0', targetId: 'red-0' }, mirror, trainers))
        .toBe('Ash’s Charizard dodged Mira’s Charizard’s attack!');
      expect(describeEvent({ kind: 'ko', turn: 1, fighterId: 'red-0' }, mirror, trainers))
        .toBe('Ash’s Charizard is knocked out!');
    });

    it('keeps unique species plain', () => {
      expect(describeEvent({ kind: 'enter', turn: 0, fighterId: 'blue-1' }, mirror, trainers)).toBe('Gengar steps into the arena.');
    });

    it('falls back to the side colour without trainer names, or when the names match', () => {
      expect(describeEvent(moveEvt, mirror)).toBe('Blue’s Charizard used Flamethrower!');
      expect(describeEvent(moveEvt, mirror, { red: 'Sam', blue: 'Sam' })).toBe('Blue’s Charizard used Flamethrower!');
    });
  });

  it('names the winning trainer when trainer names are given', () => {
    const trainers = { red: 'Ash', blue: 'Mira' };
    expect(describeEvent({ kind: 'end', turn: 9, winner: 'blue', reason: 'knockout', summary: [] }, fighters, trainers))
      .toBe('Mira wins by knockout!');
    expect(describeEvent({ kind: 'end', turn: 40, winner: 'red', reason: 'turnCap', summary: [] }, fighters, trainers))
      .toBe('Turn limit reached — Ash wins on remaining HP.');
    expect(describeEvent({ kind: 'end', turn: 9, winner: 'red', reason: 'knockout', summary: [] }, fighters))
      .toBe('Red wins by knockout!');
  });
});
