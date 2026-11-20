import { useEffect, type RefObject } from 'react';
import { ScrollTrigger } from './gsap';

const SETTLE_MS = 150;

/**
 * Re-measures every ScrollTrigger when the observed element changes size — e.g. the team loads,
 * the form grows a row of chips or the showcase resets. ScrollTrigger only refreshes on window
 * resize by itself, so content-driven height changes would otherwise leave stale start/end points.
 */
export function useScrollTriggerRefresh(ref: RefObject<Element | null>, enabled = true) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled || typeof ResizeObserver === 'undefined') return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastHeight = -1;
    const observer = new ResizeObserver((entries) => {
      const height = entries[0]?.contentRect.height ?? 0;
      if (Math.abs(height - lastHeight) < 1) return;
      const first = lastHeight < 0;
      lastHeight = height;
      if (first) return; // the initial observation is just the mount size
      clearTimeout(timer);
      timer = setTimeout(() => ScrollTrigger.refresh(), SETTLE_MS);
    });
    observer.observe(el);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [ref, enabled]);
}
