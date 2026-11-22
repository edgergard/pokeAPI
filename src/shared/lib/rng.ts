/** Seeded PRNG (mulberry32). Returns a function yielding floats in [0, 1). The only randomness in game logic. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Mixes a root seed with counters/labels into a new 32-bit seed (FNV-1a over the parts).
 * Use it to derive reproducible sub-seeds: `hashSeed(save.meta.seed, 'pull', save.meta.pullIndex)`.
 */
export function hashSeed(...parts: (string | number)[]): number {
  let h = 0x811c9dc5;
  for (const part of parts) {
    const text = String(part);
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    h ^= 0x2c; // separator so ('ab', 'c') ≠ ('a', 'bc')
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
