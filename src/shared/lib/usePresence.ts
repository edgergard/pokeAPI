import { useEffect, useRef, useState } from 'react';

export type PresenceItem = { key: string; leaving: boolean; exitIndex: number };

type State = { items: string[]; rendered: string[]; leaving: string[] };

const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((item, i) => item === b[i]);

/** Re-inserts removed keys at (or before) their previous index so the visual order holds. */
function withLeaving(items: string[], prevRendered: string[]) {
  const next = [...items];
  prevRendered.forEach((key, index) => {
    if (!items.includes(key)) next.splice(Math.min(index, next.length), 0, key);
  });
  return next;
}

/**
 * Keeps removed keys rendered for `exitMs` so they can play an exit animation.
 * `onBeforeDrop` runs right before leaving keys are removed (e.g. to record FLIP rects).
 */
export function usePresence(items: string[], exitMs: number, onBeforeDrop?: () => void): PresenceItem[] {
  const [state, setState] = useState<State>(() => ({ items, rendered: items, leaving: [] }));
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const beforeDrop = useRef(onBeforeDrop);

  useEffect(() => {
    beforeDrop.current = onBeforeDrop;
  });

  // Derive the rendered list during render (React's "adjust state on prop change" pattern).
  let current = state;
  if (!sameList(state.items, items)) {
    if (exitMs <= 0) {
      current = { items, rendered: items, leaving: [] };
    } else {
      const rendered = withLeaving(items, state.rendered);
      current = { items, rendered, leaving: rendered.filter((key) => !items.includes(key)) };
    }
    setState(current);
  }

  useEffect(() => {
    const pending = timers.current;

    // Keys that came back mid-exit: forget their pending removal.
    for (const key of [...pending.keys()]) {
      if (!state.leaving.includes(key)) pending.delete(key);
    }

    // Keys that started leaving in the same update share one timer, so they drop together.
    const fresh = state.leaving.filter((key) => !pending.has(key));
    if (fresh.length === 0) return;
    const timer = setTimeout(() => {
      const drop = fresh.filter((key) => pending.get(key) === timer);
      drop.forEach((key) => pending.delete(key));
      if (drop.length === 0) return;
      beforeDrop.current?.();
      setState((s) => ({
        ...s,
        rendered: s.rendered.filter((key) => !drop.includes(key) || s.items.includes(key)),
        leaving: s.leaving.filter((key) => !drop.includes(key)),
      }));
    }, exitMs);
    fresh.forEach((key) => pending.set(key, timer));
  }, [state.leaving, exitMs]);

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const leavingOrder = current.rendered.filter((key) => current.leaving.includes(key)).reverse();
  return current.rendered.map((key) => ({
    key,
    leaving: current.leaving.includes(key),
    exitIndex: Math.max(0, leavingOrder.indexOf(key)),
  }));
}
