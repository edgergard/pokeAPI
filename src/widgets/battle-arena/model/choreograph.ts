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
  /**
   * Every exchange plays its full beat (anticipation, lunge, impact), never the short one: the
   * onboarding battle is short in turns, so it is paced as a showcase (default false).
   */
  fullExchanges?: boolean;
};

export function tierFor(event: ResultEvent, isFirstAttack: boolean, fullExchanges = false): Tier {
  if (isFirstAttack || fullExchanges) return 'full';
  if (event.kind !== 'hit') return 'short';
  return event.effectiveness > 1 || event.critical ? 'full' : 'short';
}

/** Which beats may be sped up: short exchanges first, full exchanges only as a last resort. */
type Compress = 'short' | 'full' | 'never';

/** `first` = index of the first event the unit reports (-1 for the intro). */
type Unit = { sub: Timeline; duration: number; compress: Compress; first: number };

/** Label placed at the start of the beat that reports event `index`. */
export const eventLabel = (index: number) => `event-${index}`;

/**
 * Time at which to restart a rebuilt timeline so the beat that reported event `index` plays
 * again (0 = from the intro). Seeking there re-runs the earlier beats instantly; their events
 * are not re-delivered beyond the choreographer's own once-only rule, so callers filter by index.
 */
export function resumeTime(timeline: Timeline, index: number): number {
  for (let i = index; i >= 0; i -= 1) {
    const t = timeline.labels[eventLabel(i)];
    if (t !== undefined) return t;
  }
  return 0;
}

const isResult = (e: BattleEvent | undefined): e is ResultEvent =>
  e !== undefined && (e.kind === 'hit' || e.kind === 'miss' || e.kind === 'noEffect');

const speedFor = (
  unit: Unit,
  shortScale: number,
  fullScale: number,
  minSeconds: number,
): number => {
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
    if (total(mid) > target) lo = mid;
    else hi = mid;
  }
  return hi;
}

/**
 * Turns battle events into one paused master timeline.
 * Delivery contract: forward playback delivers each event's `onEvent` exactly once and in order;
 * seeking or playing backward never re-delivers. To replay from the start, call choreograph() again.
 */
export function choreograph(
  events: BattleEvent[],
  director: StageDirector,
  opts: ChoreographOptions,
): { timeline: Timeline; seconds: number } {
  const target = opts.targetSeconds ?? 90;
  const minSeconds = opts.minShortSeconds ?? 0.35;
  const seenAttackers = new Set<string>();
  const units: Unit[] = [];
  let highestDelivered = -1;
  // Zero-duration calls also fire on reverse crossings, so deliver by event index, never twice.
  const deliver = (index: number, event: BattleEvent) => {
    if (index <= highestDelivered) return;
    highestDelivered = index;
    opts.onEvent(event);
  };

  const addUnit = (compress: Compress, first: number, build: (sub: Timeline) => void) => {
    const sub = gsap.timeline();
    build(sub);
    units.push({ sub, duration: sub.duration(), compress, first });
  };
  // Each beat reports its event the moment it starts, except a move's result, which lands at impact.
  const simple = (index: number, event: BattleEvent, beat?: () => Timeline) =>
    addUnit('never', index, (sub) => {
      sub.call(() => deliver(index, event), [], 0);
      if (beat) sub.add(beat(), 0);
    });

  addUnit('never', -1, (sub) => {
    sub.add(director.intro(), 0);
  });

  for (let i = 0; i < events.length; i += 1) {
    const event = events[i];
    if (!event) continue;
    switch (event.kind) {
      case 'move': {
        const next = events[i + 1];
        const result = isResult(next) ? next : null;
        const moveIndex = i;
        if (result) i += 1;
        const first = !seenAttackers.has(event.attackerId);
        seenAttackers.add(event.attackerId);
        const tier: Tier = result ? tierFor(result, first, opts.fullExchanges) : 'full';
        addUnit(tier === 'short' ? 'short' : 'full', moveIndex, (sub) => {
          sub.call(() => deliver(moveIndex, event), [], 0);
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
            sub.call(() => deliver(moveIndex + 1, result), [], t);
            const info =
              result.kind === 'hit'
                ? {
                    damage: result.damage,
                    effectiveness: result.effectiveness,
                    critical: result.critical,
                  }
                : null;
            sub.add(director.impact(event.targetId, result.kind, info, tier), t);
          }
        });
        break;
      }
      case 'enter':
        simple(i, event, () => director.dealIn(event.fighterId));
        break;
      case 'ko':
        simple(i, event, () => director.knockOut(event.fighterId));
        break;
      case 'end':
        simple(i, event, () => director.victory(event.winner));
        break;
      default:
        simple(i, event); // turnStart (or a stray result): no beat, still reported in order
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
    if (unit.first >= 0) timeline.addLabel(eventLabel(unit.first), cursor);
    timeline.add(unit.sub, cursor);
    cursor += unit.duration / speed;
  }
  return { timeline, seconds: timeline.duration() };
}
