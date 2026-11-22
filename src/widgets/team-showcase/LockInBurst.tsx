import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type AnimationEvent,
  type CSSProperties,
} from 'react';
import { cn } from '@/shared/lib/cn';
import { usePrefersReducedMotion } from '@/shared/lib/motion';

const SPARK_COUNT = 18;
const FALLBACK_COLORS = ['#ffd23f', '#ff8a4c', '#ff5d8f', '#ffffff'];
/** Safety net in case animationend never arrives once the burst has started. */
const CLEANUP_MS = 2200;

type Props = {
  /** Team type colours; captured once on mount. */
  colors: string[];
};

/** One-shot ring + spark burst that plays after the last card lands, then unmounts itself. */
export function LockInBurst({ colors }: Props) {
  const reduced = usePrefersReducedMotion();
  const [palette] = useState(() => (colors.length > 1 ? colors : FALLBACK_COLORS));
  const [done, setDone] = useState(false);
  const cleanup = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(cleanup.current), []);

  // Deterministic spread — no Math.random, so renders are stable.
  const sparks = useMemo(
    () =>
      Array.from({ length: SPARK_COUNT }, (_, i) => {
        const angle = (i / SPARK_COUNT) * Math.PI * 2 + (((i * 37) % 10) / 10) * 0.3;
        const distance = 140 + ((i * 53) % 120);
        return {
          round: i % 3 === 0,
          style: {
            '--dx': `${(Math.cos(angle) * distance).toFixed(1)}px`,
            '--dy': `${(Math.sin(angle) * distance).toFixed(1)}px`,
            '--rot': `${((i * 97) % 540) - 270}deg`,
            background: palette[i % palette.length],
          } as CSSProperties,
        };
      }),
    [palette],
  );

  // A save seen with motion off counts as shown, so switching motion back on never replays it out of context.
  if (reduced && !done) setDone(true);
  if (reduced || done) return null;

  const onStart = (e: AnimationEvent) => {
    if (e.animationName !== 'burst-ring' || cleanup.current) return;
    cleanup.current = setTimeout(() => setDone(true), CLEANUP_MS);
  };

  // Sparks outlast the ring, so the burst unmounts when they finish.
  const onEnd = (e: AnimationEvent) => {
    if (e.animationName === 'spark') setDone(true);
  };

  return (
    <div
      aria-hidden
      onAnimationStart={onStart}
      onAnimationEnd={onEnd}
      className="pointer-events-none absolute top-1/2 left-1/2 z-10 size-0"
    >
      <span className="burst-ring" />
      {sparks.map((spark, i) => (
        <span
          key={i}
          style={spark.style}
          className={cn(
            'burst-spark',
            spark.round ? 'size-1 rounded-full' : 'h-[3px] w-1.5 rounded-[2px]',
          )}
        />
      ))}
    </div>
  );
}
