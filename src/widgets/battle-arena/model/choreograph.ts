import type { BattleEvent } from '@/entities/battle';
import { gsap } from '@/shared/lib/gsap';
import type { StageDirector, Tier } from './director';

type ResultEvent = Extract<BattleEvent, { kind: 'hit' | 'miss' | 'noEffect' }>;
type Timeline = gsap.core.Timeline;

export type ChoreographOptions = {
  onEvent(event: BattleEvent): void;
  /** Total length the battle is compressed to fit (default 90 s). */
  targetSeconds?: number;
  /** A compressed exchange is never shorter than this (default 0.35 s). */
  minShortSeconds?: number;
};

export function tierFor(event: ResultEvent, isFirstAttack: boolean): Tier {
  if (isFirstAttack) return 'full';
  if (event.kind !== 'hit') return 'short';
  return event.effectiveness > 1 || event.critical ? 'full' : 'short';
}

/** Which beats may be sped up: short exchanges first, full exchanges only as a last resort. */
type Compress = 'short' | 'full' | 'never';

type Unit = { sub: Timeline; duration: number; compress: Compress };

const isResult = (e: BattleEvent | undefined): e is ResultEvent =>
  e !== undefined && (e.kind === 'hit' || e.kind === 'miss' || e.kind === 'noEffect');

const speedFor = (unit: Unit, shortScale: number, fullScale: number, minSeconds: number): number => {
  const wanted = unit.compress === 'short' ? shortScale : unit.compress === 'full' ? fullScale : 1;
  const cap = unit.duration > 0 ? unit.duration / minSeconds : 1;
  return Math.max(1, Math.min(wanted, cap));
};

/** Smallest scale in [1, MAX] for which `total(scale) <= target` (MAX if even that does not fit). */
function solveScale(total: (scale: number) => number, target: number): number {
  const MAX = 1e4;
  if (total(MAX) > target) return MAX;
  let lo = 1;
  let hi = MAX;
  for (let n = 0; n < 60; n += 1) {
    const mid = (lo + hi) / 2;
    if (total(mid) > target) lo = mid; else hi = mid;
  }
  return hi;
}

export function choreograph(
  events: BattleEvent[],
  director: StageDirector,
  opts: ChoreographOptions,
): { timeline: Timeline; seconds: number } {
  const target = opts.targetSeconds ?? 90;
  const minSeconds = opts.minShortSeconds ?? 0.35;
  const seenAttackers = new Set<string>();
  const units: Unit[] = [];

  const addUnit = (compress: Compress, build: (sub: Timeline) => void) => {
    const sub = gsap.timeline();
    build(sub);
    units.push({ sub, duration: sub.duration(), compress });
  };
  // Each beat reports its event the moment it starts, except a move's result, which lands at impact.
  const simple = (event: BattleEvent, beat?: () => Timeline) => addUnit('never', (sub) => {
    sub.call(() => opts.onEvent(event), [], 0);
    if (beat) sub.add(beat(), 0);
  });

  addUnit('never', (sub) => { sub.add(director.intro(), 0); });

  for (let i = 0; i < events.length; i += 1) {
    const event = events[i];
    if (!event) continue;
    switch (event.kind) {
      case 'move': {
        const next = events[i + 1];
        const result = isResult(next) ? next : null;
        if (result) i += 1;
        const first = !seenAttackers.has(event.attackerId);
        seenAttackers.add(event.attackerId);
        const tier: Tier = result ? tierFor(result, first) : 'full';
        addUnit(tier === 'short' ? 'short' : 'full', (sub) => {
          sub.call(() => opts.onEvent(event), [], 0);
          let t = 0;
          if (tier === 'full') {
            const anticipation = director.anticipate(event.attackerId, event.move, tier);
            sub.add(anticipation, t);
            t += anticipation.duration();
          }
          const lunge = director.lunge(event.attackerId, event.targetId, event.move, tier);
          sub.add(lunge, t);
          t += lunge.duration();
          if (result) {
            sub.call(() => opts.onEvent(result), [], t);
            const info = result.kind === 'hit'
              ? { damage: result.damage, effectiveness: result.effectiveness, critical: result.critical }
              : null;
            sub.add(director.impact(event.targetId, result.kind, info, tier), t);
          }
        });
        break;
      }
      case 'enter': simple(event, () => director.dealIn(event.fighterId)); break;
      case 'ko': simple(event, () => director.knockOut(event.fighterId)); break;
      case 'end': simple(event, () => director.victory(event.winner)); break;
      default: simple(event); // turnStart (or a stray result): no beat, still reported in order
    }
  }

  const total = (shortScale: number, fullScale: number) =>
    units.reduce((sum, u) => sum + u.duration / speedFor(u, shortScale, fullScale, minSeconds), 0);

  let shortScale = 1;
  let fullScale = 1;
  if (total(1, 1) > target) {
    shortScale = solveScale((s) => total(s, 1), target);
    if (total(shortScale, 1) > target) fullScale = solveScale((f) => total(shortScale, f), target);
  }

  const timeline = gsap.timeline({ paused: true });
  let cursor = 0;
  for (const unit of units) {
    const speed = speedFor(unit, shortScale, fullScale, minSeconds);
    unit.sub.timeScale(speed);
    timeline.add(unit.sub, cursor);
    cursor += unit.duration / speed;
  }
  return { timeline, seconds: timeline.duration() };
}
