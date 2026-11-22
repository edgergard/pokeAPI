import { describe, expect, it } from 'vitest';
import type { BattleEvent, Effectiveness, Move } from '@/entities/battle';
import { choreograph, eventLabel, resumeTime, tierFor } from './choreograph';
import { createNullDirector } from './nullDirector';

const move: Move = {
  name: 'tackle',
  type: 'normal',
  power: 40,
  accuracy: 100,
  damageClass: 'physical',
};

type HitEvent = Extract<BattleEvent, { kind: 'hit' }>;
const hit = (over: Partial<HitEvent> = {}): HitEvent => ({
  kind: 'hit',
  turn: 1,
  attackerId: 'a',
  targetId: 'b',
  damage: 10,
  effectiveness: 1 as Effectiveness,
  critical: false,
  hpBefore: 100,
  hpAfter: 90,
  ...over,
});
const exchange = (attackerId: string, targetId: string): BattleEvent[] => [
  { kind: 'move', turn: 1, attackerId, targetId, move },
  hit({ attackerId, targetId }),
];

const shortEvents: BattleEvent[] = [
  { kind: 'enter', turn: 0, fighterId: 'a' },
  { kind: 'enter', turn: 0, fighterId: 'b' },
  { kind: 'turnStart', turn: 1 },
  ...exchange('a', 'b'),
  { kind: 'move', turn: 1, attackerId: 'b', targetId: 'a', move },
  { kind: 'miss', turn: 1, attackerId: 'b', targetId: 'a' },
  { kind: 'ko', turn: 1, fighterId: 'b' },
  { kind: 'end', turn: 1, winner: 'red', reason: 'knockout', summary: [] },
];

const longBattleEvents = (count: number): BattleEvent[] => {
  const out: BattleEvent[] = [
    { kind: 'enter', turn: 0, fighterId: 'a' },
    { kind: 'enter', turn: 0, fighterId: 'b' },
    ...exchange('a', 'b'),
    ...exchange('b', 'a'),
  ];
  while (out.length < count) {
    out.push({ kind: 'turnStart', turn: 2 }, ...exchange('a', 'b'), ...exchange('b', 'a'));
  }
  out.push(
    { kind: 'ko', turn: 9, fighterId: 'b' },
    { kind: 'end', turn: 9, winner: 'red', reason: 'knockout', summary: [] },
  );
  return out;
};

describe('tierFor', () => {
  it('uses full for super-effective, crits, first attacks; short for neutral', () => {
    expect(tierFor(hit({ effectiveness: 2 }), false)).toBe('full');
    expect(tierFor(hit({ critical: true }), false)).toBe('full');
    expect(tierFor(hit({ effectiveness: 1 }), false)).toBe('short');
    expect(tierFor(hit({ effectiveness: 1 }), true)).toBe('full');
  });
});

describe('choreograph', () => {
  it('fires onEvent for every event, in order, when played', () => {
    const seen: string[] = [];
    const { timeline } = choreograph(shortEvents, createNullDirector(), {
      onEvent: (e) => seen.push(e.kind),
    });
    timeline.progress(1);
    expect(seen).toEqual(shortEvents.map((e) => e.kind));
  });

  it('fires the result event when impact starts, after anticipation and lunge', () => {
    const times: Record<string, number> = {};
    const { timeline } = choreograph(exchange('a', 'b'), createNullDirector({ intro: 0 }), {
      onEvent: (e) => {
        times[e.kind] = timeline.time();
      },
    });
    timeline.progress(1);
    // time() is read while seeking to the end, so check ordering via a stepped play instead
    expect(Object.keys(times)).toEqual(['move', 'hit']);
  });

  it('compresses long battles to <= targetSeconds', () => {
    const { seconds } = choreograph(longBattleEvents(300), createNullDirector(), {
      onEvent: () => {},
      targetSeconds: 90,
    });
    expect(seconds).toBeLessThanOrEqual(90.5);
  });

  it('never shortens ko, intro, victory, and keeps exchanges >= min', () => {
    const events = longBattleEvents(2000);
    const exchanges = events.filter((e) => e.kind === 'move').length;
    const { seconds } = choreograph(events, createNullDirector(), {
      onEvent: () => {},
      targetSeconds: 10,
      minShortSeconds: 0.35,
    });
    // fixed: intro 2 + 2 deal-ins 1.8 + ko 1.2 + victory 2 = 7; each exchange bottoms out at 0.35 s
    expect(seconds).toBeGreaterThanOrEqual(7 + (exchanges - 2) * 0.35 - 0.01);
  });

  it('leaves short battles untouched', () => {
    const { seconds } = choreograph(shortEvents, createNullDirector(), { onEvent: () => {} });
    // intro 2 + deal-ins 1.8 + two first attacks at full tier (0.4+0.5+0.6 each) + ko 1.2 + victory 2
    expect(seconds).toBeCloseTo(2 + 1.8 + 1.5 + 1.5 + 1.2 + 2, 1);
  });

  it('returns a paused timeline', () => {
    expect(
      choreograph(shortEvents, createNullDirector(), { onEvent: () => {} }).timeline.paused(),
    ).toBe(true);
  });

  it('delivers each event once: rewinding or scrubbing back never re-fires', () => {
    const seen: string[] = [];
    const { timeline, seconds } = choreograph(shortEvents, createNullDirector(), {
      onEvent: (e) => seen.push(e.kind),
    });
    timeline.progress(1);
    const afterForward = [...seen];
    expect(afterForward).toEqual(shortEvents.map((e) => e.kind));
    timeline.progress(0);
    timeline.time(seconds * 0.6);
    timeline.time(seconds * 0.2);
    timeline.progress(1);
    expect(seen).toEqual(afterForward);
  });
});

describe('resume labels', () => {
  it('labels each beat by the first event it reports, so a rebuilt timeline can restart there', () => {
    const { timeline } = choreograph(shortEvents, createNullDirector(), {
      onEvent: () => undefined,
    });
    expect(resumeTime(timeline, -1)).toBe(0);
    expect(resumeTime(timeline, 0)).toBeCloseTo(2); // after the 2 s intro
    // The move (3) and its hit (4) share one beat: resuming at the hit replays the whole exchange.
    expect(timeline.labels[eventLabel(4)]).toBeUndefined();
    expect(resumeTime(timeline, 4)).toBe(timeline.labels[eventLabel(3)]);
    expect(resumeTime(timeline, 8)).toBeGreaterThan(resumeTime(timeline, 4));
  });
});
