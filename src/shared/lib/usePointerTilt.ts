import { useEffect, useRef, type RefObject } from 'react';
import { usePrefersReducedMotion } from './motion';

const MAX_TILT_DEG = 8;
const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)';

const clamp = (n: number) => Math.max(-1, Math.min(1, n));

/**
 * Writes --rx/--ry (tilt angles) and --px/--py (-1..1 pointer position) on the element
 * while a fine pointer hovers it. Never re-renders React for pointer moves; inert on touch
 * and reduced motion, and both are re-checked live (the setting or pointer mode can change).
 * An ancestor with [data-tilt-paused] (e.g. a slot being dragged) suspends the tilt and settles it flat.
 */
export function usePointerTilt<T extends HTMLElement>(): RefObject<T | null> {
  const ref = useRef<T>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    const finePointer = window.matchMedia(FINE_POINTER_QUERY);

    let rect: DOMRect | null = null;
    let frame = 0;
    let lastX = 0;
    let lastY = 0;

    const write = (rx: string, ry: string, px: string, py: string) => {
      el.style.setProperty('--rx', rx);
      el.style.setProperty('--ry', ry);
      el.style.setProperty('--px', px);
      el.style.setProperty('--py', py);
    };

    const paused = () => el.closest('[data-tilt-paused]') !== null;
    const canTilt = (e: PointerEvent) =>
      e.pointerType !== 'touch' && finePointer.matches && !paused();

    const onEnter = (e: PointerEvent) => {
      if (!canTilt(e)) return;
      rect = el.getBoundingClientRect();
      el.dataset.tilting = '';
    };

    const onMove = (e: PointerEvent) => {
      if (!canTilt(e)) {
        if (el.dataset.tilting !== undefined) onLeave();
        return;
      }
      lastX = e.clientX;
      lastY = e.clientY;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        rect ??= el.getBoundingClientRect();
        el.dataset.tilting ??= ''; // resumed after a pause without a fresh pointerenter
        const px = clamp(((lastX - rect.left) / rect.width) * 2 - 1);
        const py = clamp(((lastY - rect.top) / rect.height) * 2 - 1);
        write(
          `${(-py * MAX_TILT_DEG).toFixed(2)}deg`,
          `${(px * MAX_TILT_DEG).toFixed(2)}deg`,
          px.toFixed(3),
          py.toFixed(3),
        );
      });
    };

    const onLeave = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      rect = null;
      delete el.dataset.tilting;
      write('0deg', '0deg', '0', '0');
    };

    const onScroll = () => {
      rect = null;
    };

    el.addEventListener('pointerenter', onEnter);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    window.addEventListener('scroll', onScroll, { passive: true });

    return () => {
      el.removeEventListener('pointerenter', onEnter);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      window.removeEventListener('scroll', onScroll);
      // Settle flat if reduced motion was switched on mid-hover.
      onLeave();
    };
  }, [reduced]);

  return ref;
}
