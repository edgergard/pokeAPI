import type { CSSProperties } from 'react';
import { CapsuleGlyph } from '@/shared/ui/CapsuleGlyph';
import { makeParticles } from './ambient';

const PARTICLES = makeParticles(24);

/** Faint capsule silhouettes: position, size (rem), float/spin periods (s) and spin direction. */
type Ball = Pick<CSSProperties, 'left' | 'right' | 'top' | 'bottom'> & {
  size: number;
  float: number;
  spin: number;
  dir: 'normal' | 'reverse';
};

const BALLS: Ball[] = [
  { left: '-4rem', top: '12%', size: 14, float: 11, spin: 70, dir: 'normal' },
  { right: '-5rem', top: '8%', size: 18, float: 14, spin: 90, dir: 'reverse' },
  { left: '8%', bottom: '6%', size: 9, float: 9, spin: 60, dir: 'reverse' },
  { right: '12%', bottom: '18%', size: 11, float: 12, spin: 80, dir: 'normal' },
];

const TINT = {
  red: 'var(--color-side-red)',
  blue: 'var(--color-side-blue)',
  gold: 'var(--color-accent)',
} as const;

/**
 * Battle page backdrop: drifting corner glows, a perspective floor, rising motes and slow capsules.
 * Pure CSS (transform / opacity loops under data-motion='full'); reduced motion keeps the glows only.
 * `paused` freezes the loops (during a battle they would compete with the WebGL arena for the GPU).
 */
export function BattleAmbient({ paused = false }: { paused?: boolean }) {
  return (
    <div
      aria-hidden
      data-paused={paused || undefined}
      className="battle-ambient pointer-events-none fixed inset-0 -z-10 overflow-hidden"
    >
      <span className="amb-glow amb-glow-red" />
      <span className="amb-glow amb-glow-blue" />
      <span className="amb-floor" />
      {BALLS.map(({ size, float, spin, dir, ...pos }, i) => (
        <span
          key={i}
          className="amb-ball"
          // The wrapper floats; the ball inside spins, reading --spin / --dir from here.
          style={
            {
              ...pos,
              width: `${size}rem`,
              height: `${size}rem`,
              '--float': `${float}s`,
              '--spin': `${spin}s`,
              '--dir': dir,
              '--i': i,
            } as CSSProperties
          }
        >
          <CapsuleGlyph className="amb-ball-spin size-full" />
        </span>
      ))}
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="amb-particle"
          style={
            {
              left: `${p.x}%`,
              width: p.size,
              height: p.size,
              background: TINT[p.tint],
              '--d': `${p.duration}s`,
              '--delay': `${p.delay}s`,
              '--sway': `${p.sway}px`,
              '--o': p.opacity,
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
