import { useCallback, useEffect, useRef, useState } from 'react';
import { DUR, easeOutExpo, prefersReducedMotion, usePrefersReducedMotion } from './motion';

type Phase = 'idle' | 'running' | 'done';
type Tick = (now: number) => void;

/* One rAF drives every running counter, so a full team of stat bars costs a single callback per frame. */
const ticks = new Set<Tick>();
let rafId = 0;

const loop = (now: number) => {
  rafId = 0;
  ticks.forEach((tick) => tick(now));
  if (ticks.size > 0) rafId = requestAnimationFrame(loop);
};

function addTick(tick: Tick) {
  ticks.add(tick);
  if (!rafId) rafId = requestAnimationFrame(loop);
}

function removeTick(tick: Tick) {
  ticks.delete(tick);
  if (ticks.size === 0 && rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
}

/**
 * Counts from 0 to `target` on the --ease-out-expo curve once `start()` is called.
 * React only renders the phase (0 → target); the in-between digits are written straight into
 * the element behind `ref`, so counting never re-renders. Attach `ref` to an element whose only
 * child is `{display}`. Under reduced motion `display` is always the target.
 */
export function useCountUp<T extends HTMLElement = HTMLSpanElement>(target: number, duration: number = DUR.xxl) {
  const reduced = usePrefersReducedMotion();
  const [phase, setPhase] = useState<Phase>('idle');
  const ref = useRef<T>(null);
  const tickRef = useRef<Tick | null>(null);
  const targetRef = useRef(target);

  useEffect(() => {
    targetRef.current = target;
  }, [target]);

  const cancel = useCallback(() => {
    if (tickRef.current) removeTick(tickRef.current);
    tickRef.current = null;
  }, []);

  const finish = useCallback(() => {
    cancel();
    setPhase('done');
  }, [cancel]);

  const start = useCallback(() => {
    if (prefersReducedMotion()) return;
    cancel();
    setPhase('running');
    let startedAt = -1;

    const tick: Tick = (now) => {
      if (startedAt < 0) startedAt = now;
      const progress = Math.min(1, (now - startedAt) / duration);
      const el = ref.current;
      if (el) el.textContent = String(Math.round(targetRef.current * easeOutExpo(progress)));
      if (progress >= 1) finish();
    };
    tickRef.current = tick;
    addTick(tick);
  }, [cancel, finish, duration]);

  useEffect(() => cancel, [cancel]);

  const display = reduced || phase === 'done' ? target : 0;
  return { ref, display, start, finish };
}
