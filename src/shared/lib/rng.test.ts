import { describe, expect, it } from 'vitest';
import { createRng, hashSeed } from './rng';

describe('rng', () => {
  it('is deterministic per seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it('hashSeed separates parts and is stable', () => {
    expect(hashSeed(1, 'pull', 0)).toBe(hashSeed(1, 'pull', 0));
    expect(hashSeed('ab', 'c')).not.toBe(hashSeed('a', 'bc'));
    expect(hashSeed(1, 'pull', 0)).not.toBe(hashSeed(1, 'pull', 1));
  });
});
