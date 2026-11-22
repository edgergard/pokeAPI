import { useRef, useState, type KeyboardEvent, type RefObject } from 'react';
import { formatName } from '@/shared/lib/format';
import { GSAP_EASE, gsap, useGSAP } from '@/shared/lib/gsap';
import type { FlipState } from '@/shared/lib/gsap-interactive';
import { prefersReducedMotion, usePrefersReducedMotion } from '@/shared/lib/motion';
import { useGsapInteractive } from '@/shared/lib/useGsapInteractive';

type Options = {
  /** The grid holding one `[data-slot]` wrapper per slot (each with a `[data-drag-handle]`). */
  gridRef: RefObject<HTMLElement | null>;
  /** Pokémon slugs in slot order. */
  team: readonly string[];
  /** Changes when the grid remounts (a new save). */
  version: string;
  enabled: boolean;
  onSwap: (from: number, to: number) => void;
  announce: (message: string) => void;
};

type Pending = {
  /** Positions before the swap; null under reduced motion (no animation). */
  state: FlipState | null;
  /** Slug of the slot to keep focused (keyboard moves). */
  focus: string | null;
};

type PageRect = { left: number; top: number; right: number; bottom: number };

const SLOT_SELECTOR = '[data-slot]';

const toPageRect = (el: Element): PageRect => {
  const r = el.getBoundingClientRect();
  return {
    left: r.left + window.scrollX,
    top: r.top + window.scrollY,
    right: r.right + window.scrollX,
    bottom: r.bottom + window.scrollY,
  };
};

const hitIndex = (rects: PageRect[], x: number, y: number) => {
  const i = rects.findIndex((r) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom);
  return i < 0 ? null : i;
};

/** Clears every per-drag marker a slot can carry. */
const releaseSlot = (el: HTMLElement) => {
  delete el.dataset.dragging;
  delete el.dataset.tiltPaused;
  delete el.dataset.dropTarget;
};

const KEY_STEP: Record<string, number> = {
  ArrowLeft: -1,
  ArrowUp: -1,
  ArrowRight: 1,
  ArrowDown: 1,
};

/**
 * Reorders team slots by dragging a card's handle onto another slot (Draggable) or with
 * Alt + arrow keys on a focused slot. Either way the two slots swap and Flip glides every card
 * from where it was to where it now is. Under reduced motion the swap is instant — reordering
 * itself never depends on animation. Draggable and Flip are loaded on demand once `enabled`; until they
 * arrive, Alt + arrows still swap (instantly) and the drag handles arm as soon as the chunk lands.
 *
 * Because keyed slots really move in the DOM, the caller should mark the grid "settled" (see
 * `settled`) so one-shot CSS entrances inside the moved nodes don't replay.
 */
export function useSlotReorder({ gridRef, team, version, enabled, onSwap, announce }: Options) {
  const reduced = usePrefersReducedMotion();
  const fx = useGsapInteractive(enabled);
  const pending = useRef<Pending | null>(null);
  const [flipToken, setFlipToken] = useState(0);
  const [settledFor, setSettledFor] = useState<string | null>(null);

  const slots = () =>
    Array.from(gridRef.current?.querySelectorAll<HTMLElement>(SLOT_SELECTOR) ?? []);

  const commit = (from: number, to: number, next: Pending) => {
    const moved = team[from];
    const displaced = team[to];
    if (moved === undefined || displaced === undefined) return;
    pending.current = next;
    setSettledFor(version);
    setFlipToken((token) => token + 1);
    onSwap(from, to);
    announce(
      `${formatName(moved)} moved to slot ${to + 1} of ${team.length}. ${formatName(displaced)} is now in slot ${from + 1}.`,
    );
  };

  /* ---------- Pointer: Draggable on each slot, grabbed by its handle ---------- */

  const orderKey = `${version}|${team.join(',')}`;

  // Declared before the Flip hook on purpose: React runs cleanups in hook order, so each Draggable
  // restores its creation-time transform first and the Flip context's revert has the last word.
  useGSAP(
    () => {
      if (!enabled || !fx) return;
      const { Draggable, Flip } = fx;
      const els = slots();
      const snapBacks = new Set<gsap.core.Tween>();

      const draggables = els.map((el, index) => {
        const handle = el.querySelector<HTMLElement>('[data-drag-handle]');
        if (!handle) return null;

        let rects: PageRect[] = [];
        let over: number | null = null;
        const setOver = (next: number | null) => {
          if (next === over) return;
          if (over !== null) delete els[over]?.dataset.dropTarget;
          over = next;
          if (next !== null && next !== index) els[next]!.dataset.dropTarget = '';
        };

        const draggable: Draggable = new Draggable(el, {
          type: 'x,y',
          trigger: handle, // only the handle blocks touch scrolling (touch-action: none)
          autoScroll: 1,
          zIndexBoost: false, // [data-dragging] lifts the slot via CSS instead
          onPress: () => {
            el.dataset.tiltPaused = '';
          },
          onRelease: () => {
            if (el.dataset.dragging === undefined) releaseSlot(el); // a press without a drag
          },
          onDragStart: () => {
            el.dataset.dragging = '';
            // The CSS deal animates this slot's transform and would override Draggable's inline one:
            // finish the one-shot entrances now, as a committed swap would.
            setSettledFor(version);
            // Slot positions are cached in page coordinates once, so the per-frame hit test reads no layout.
            rects = els.map(toPageRect);
          },
          onDrag: () => setOver(hitIndex(rects, draggable.pointerX, draggable.pointerY)),
          onDragEnd: () => {
            const target = over;
            setOver(null);

            if (target !== null && target !== index) {
              // Record positions with the card where it was dropped, so it glides on from there.
              const state = prefersReducedMotion() ? null : Flip.getState(els);
              gsap.set(el, { clearProps: 'transform' });
              commit(index, target, { state, focus: null });
              return;
            }

            if (prefersReducedMotion()) {
              gsap.set(el, { x: 0, y: 0 });
              releaseSlot(el);
              return;
            }
            const tween = gsap.to(el, {
              x: 0,
              y: 0,
              duration: 0.5,
              ease: GSAP_EASE.spring,
              onComplete: () => {
                snapBacks.delete(tween);
                releaseSlot(el);
              },
            });
            snapBacks.add(tween);
          },
        });
        return draggable;
      });

      return () => {
        snapBacks.forEach((tween) => tween.kill());
        draggables.forEach((draggable) => draggable?.kill());
        // A committed swap keeps its markers until its Flip lands; anything else lets go now.
        if (!pending.current) els.forEach(releaseSlot);
      };
    },
    { scope: gridRef, dependencies: [orderKey, enabled, reduced, fx], revertOnUpdate: true },
  );

  /* ---------- After every swap: restore focus, then Flip from the recorded positions ---------- */

  useGSAP(
    () => {
      const next = pending.current;
      pending.current = null;
      if (!next) return;
      const els = slots();
      const done = () => els.forEach(releaseSlot);

      // Keyed slots really move in the DOM, which can drop focus from the moved node.
      const focused = next.focus ? els.find((el) => el.dataset.flipId === next.focus) : undefined;
      if (focused && document.activeElement !== focused) focused.focus({ preventScroll: true });
      const reveal = () =>
        focused?.scrollIntoView({
          block: 'nearest',
          behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        });

      if (!next.state || reduced || !fx) {
        done();
        reveal();
        return;
      }

      fx.Flip.from(next.state, {
        targets: els,
        duration: 0.6,
        ease: GSAP_EASE.spring,
        onComplete: () => {
          done();
          reveal();
        },
      });
    },
    // revertOnUpdate: a newer swap (or the motion toggle) reverts an in-flight Flip; the next Flip
    // starts from positions recorded before that revert, so the glide continues without a jump.
    { scope: gridRef, dependencies: [flipToken, reduced], revertOnUpdate: true },
  );

  /* ---------- Keyboard: Alt + arrows on a focused slot ---------- */

  const onSlotKeyDown = (index: number) => (e: KeyboardEvent<HTMLElement>) => {
    const step = KEY_STEP[e.key];
    if (!enabled || !e.altKey || step === undefined || e.target !== e.currentTarget) return;
    e.preventDefault(); // Alt + ← / → is also browser history navigation
    const name = team[index];
    if (name === undefined) return;

    const to = index + step;
    if (to < 0 || to >= team.length) {
      announce(`${formatName(name)} is already in the ${to < 0 ? 'first' : 'last'} slot.`);
      return;
    }
    const state = prefersReducedMotion() || !fx ? null : fx.Flip.getState(slots());
    commit(index, to, { state, focus: name });
  };

  return { onSlotKeyDown, settled: settledFor === version };
}
