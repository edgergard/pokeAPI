import { useEffect, useRef } from 'react';
import { DUR, EASE } from '@/shared/lib/motion';

const SPARKS = 14;

/** Runs a Web Animation when the API exists (jsdom and very old browsers have none). */
export function play(
  el: Element | null,
  keyframes: Keyframe[],
  options: KeyframeAnimationOptions,
): Animation | null {
  if (!el || typeof el.animate !== 'function') return null;
  return el.animate(keyframes, options);
}

/** The rarity flash: a soft glow, a ring and a spark spray in the rarity colour. Full motion only. */
export function RevealBurst({ color }: { color: string }) {
  const glowRef = useRef<HTMLSpanElement>(null);
  const ringRef = useRef<HTMLSpanElement>(null);
  const sparksRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const running: (Animation | null)[] = [
      play(
        glowRef.current,
        [
          { opacity: 0, transform: 'scale(0.4)' },
          { opacity: 1, transform: 'scale(1)', offset: 0.35 },
          { opacity: 0.35, transform: 'scale(1.15)' },
        ],
        { duration: DUR.xl, easing: EASE.outExpo, fill: 'forwards' },
      ),
      play(
        ringRef.current,
        [
          { opacity: 1, transform: 'scale(0.4)' },
          { opacity: 0, transform: 'scale(2.4)' },
        ],
        { duration: DUR.xl, easing: EASE.outExpo, fill: 'forwards' },
      ),
    ];
    const sparks = sparksRef.current?.children ?? [];
    Array.from(sparks).forEach((spark, i) => {
      // Deterministic spread: the same burst every time, no randomness.
      const angle = (i / SPARKS) * Math.PI * 2 + ((i * 37) % 10) * 0.03;
      const distance = 120 + ((i * 53) % 90);
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;
      running.push(
        play(
          spark,
          [
            { opacity: 1, transform: 'translate(-50%, -50%) scale(0.6)' },
            {
              opacity: 1,
              transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1)`,
              offset: 0.7,
            },
            {
              opacity: 0,
              transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + 30}px)) scale(0.4)`,
            },
          ],
          { duration: DUR.xxl, easing: EASE.outExpo, fill: 'forwards' },
        ),
      );
    });
    return () => running.forEach((a) => a?.cancel());
  }, []);

  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 z-20 grid place-items-center">
      <span
        ref={glowRef}
        className="absolute size-[340px] rounded-full opacity-0"
        style={{
          background: `radial-gradient(circle, color-mix(in oklab, ${color} 70%, white), color-mix(in oklab, ${color} 25%, transparent) 45%, transparent 70%)`,
        }}
      />
      <span
        ref={ringRef}
        className="absolute size-[200px] rounded-full border-2 opacity-0"
        style={{ borderColor: color }}
      />
      <span ref={sparksRef} className="absolute top-1/2 left-1/2 size-0">
        {Array.from({ length: SPARKS }, (_, i) => (
          <span
            key={i}
            className={
              i % 3 === 0
                ? 'absolute size-1.5 rounded-full opacity-0'
                : 'absolute h-1 w-2 rounded-xs opacity-0'
            }
            style={{ background: i % 4 === 0 ? 'white' : color }}
          />
        ))}
      </span>
    </span>
  );
}
