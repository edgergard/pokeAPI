import { useRef } from 'react';
import { gsap, useGSAP } from '@/shared/lib/gsap';
import { usePrefersReducedMotion } from '@/shared/lib/motion';

const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)';

/**
 * Soft radial highlight that trails a fine pointer across its parent (which needs `relative isolate`).
 * gsap.quickTo eases the unitless --spot-x / --spot-y / --spot-o variables on this layer; CSS turns them
 * into a transform + opacity on a pre-painted glow, so pointer moves cost no React render and no repaint.
 * The parent's rect is read once per hover (and after scroll/resize), never per frame.
 */
export function Spotlight() {
  const layerRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  useGSAP(
    () => {
      const layer = layerRef.current;
      const host = layer?.parentElement;
      if (!layer || !host || reduced) return;
      const finePointer = window.matchMedia(FINE_POINTER_QUERY);

      const toX = gsap.quickTo(layer, '--spot-x', { duration: 0.55, ease: 'power3' });
      const toY = gsap.quickTo(layer, '--spot-y', { duration: 0.55, ease: 'power3' });
      const toOpacity = gsap.quickTo(layer, '--spot-o', { duration: 0.35, ease: 'power2.out' });

      let rect: DOMRect | null = null;
      const usable = (e: PointerEvent) => e.pointerType !== 'touch' && finePointer.matches;

      const onEnter = (e: PointerEvent) => {
        if (!usable(e)) return;
        rect = host.getBoundingClientRect();
        // Start at the entry point instead of sweeping in from the last exit.
        gsap.set(layer, { '--spot-x': e.clientX - rect.left, '--spot-y': e.clientY - rect.top });
        toX(e.clientX - rect.left);
        toY(e.clientY - rect.top);
        toOpacity(1);
      };

      const onMove = (e: PointerEvent) => {
        if (!usable(e)) return;
        rect ??= host.getBoundingClientRect();
        toX(e.clientX - rect.left);
        toY(e.clientY - rect.top);
      };

      const onLeave = () => {
        rect = null;
        toOpacity(0);
      };

      const invalidate = () => {
        rect = null;
      };

      host.addEventListener('pointerenter', onEnter);
      host.addEventListener('pointermove', onMove);
      host.addEventListener('pointerleave', onLeave);
      window.addEventListener('scroll', invalidate, { passive: true });
      window.addEventListener('resize', invalidate);

      return () => {
        host.removeEventListener('pointerenter', onEnter);
        host.removeEventListener('pointermove', onMove);
        host.removeEventListener('pointerleave', onLeave);
        window.removeEventListener('scroll', invalidate);
        window.removeEventListener('resize', invalidate);
      };
    },
    { scope: layerRef, dependencies: [reduced], revertOnUpdate: true },
  );

  return <div ref={layerRef} aria-hidden className="spotlight" />;
}
