/** Deterministic layout for the battle page's ambient layer (same on every render and in tests). */

export type Particle = {
  /** Horizontal position, % of the viewport width. */
  x: number;
  /** Diameter, px. */
  size: number;
  /** Seconds for one rise. */
  duration: number;
  /** Negative start offset (s), so the field is already spread out on load. */
  delay: number;
  /** Horizontal drift over one rise, px. */
  sway: number;
  /** Peak opacity. */
  opacity: number;
  tint: 'red' | 'blue' | 'gold';
};

/** Small LCG: stable pseudo-random numbers in [0, 1). */
function seeded(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

export function makeParticles(count: number, seed = 7): Particle[] {
  const rand = seeded(seed);
  return Array.from({ length: count }, (_, i) => {
    // Even spread across the width, jittered within each column.
    const x = ((i + rand()) / count) * 100;
    const duration = 16 + rand() * 14;
    return {
      x: Math.round(x * 10) / 10,
      size: 1.5 + Math.round(rand() * 2 * 10) / 10,
      duration: Math.round(duration * 10) / 10,
      delay: -Math.round(rand() * duration * 10) / 10,
      sway: Math.round((rand() - 0.5) * 60),
      opacity: Math.round((0.25 + rand() * 0.35) * 100) / 100,
      // Warm on the Red side, cool on the Blue side, an occasional spark of gold anywhere.
      tint: rand() < 0.2 ? 'gold' : x < 50 ? 'red' : 'blue',
    };
  });
}
