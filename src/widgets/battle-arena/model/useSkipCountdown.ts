import { useEffect, useState } from 'react';

/**
 * Intro battle: Skip unlocks after this many seconds of the battle on screen (design.md flow
 * first-visit step 3). A UI timing, not a game number.
 */
export const INTRO_SKIP_DELAY_SECONDS = 5;

/**
 * Seconds left before Skip unlocks: counts down from INTRO_SKIP_DELAY_SECONDS once the battle is
 * running (and not while the tab is hidden, where the battle pauses too). Always 0 outside the intro.
 */
export function useSkipCountdown(intro: boolean, running: boolean): number {
  const [left, setLeft] = useState(intro ? INTRO_SKIP_DELAY_SECONDS : 0);
  const counting = intro && running && left > 0;
  useEffect(() => {
    if (!counting) return;
    const id = window.setInterval(() => {
      if (!document.hidden) setLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [counting]);
  return intro ? left : 0;
}
